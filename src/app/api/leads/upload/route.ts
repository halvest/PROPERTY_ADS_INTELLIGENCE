import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  parseCrmLeadsFile,
  importCrmLeadsToDatabase,
} from "@/lib/crm/crm-sheets-service";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

async function readRequestBodyWithLimit(request: Request): Promise<Buffer> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    throw new UploadTooLargeError();
  }

  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        throw new UploadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
}

class UploadTooLargeError extends Error {}

/**
 * POST /api/leads/upload
 * Handles file upload (multipart/form-data) or JSON payload for CRM leads.
 * Supports:
 * - Preview & Validation mode: query param `validateOnly=true`
 * - Full commit mode: imports and upserts into database
 */
export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(rateLimitKey(request, "leads-upload"), 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak permintaan unggah.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const isProduction = process.env.NODE_ENV === "production";
    if ((authError || !user) && isProduction) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { data: profile } = user
      ? await supabase
          .from("profiles")
          .select("organization_id, role")
          .eq("id", user.id)
          .maybeSingle()
      : { data: null };

    const organizationId =
      profile?.organization_id || "00000000-0000-0000-0000-000000000001";

    const { searchParams } = request.nextUrl;
    const validateOnly = searchParams.get("validateOnly") === "true";

    const contentType = request.headers.get("content-type") || "";
    const requestBody = await readRequestBodyWithLimit(request);

    let fileBuffer: Buffer | null = null;
    let fileName = "upload.xlsx";

    if (contentType.includes("multipart/form-data")) {
      const formData = await new Response(new Uint8Array(requestBody), {
        headers: { "content-type": contentType },
      }).formData();
      const file = formData.get("file");

      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { success: false, error: "File spreadsheet (.xlsx / .csv) tidak ditemukan dalam permintaan form-data." },
          { status: 400 }
        );
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { success: false, error: "Ukuran file melebihi batas maksimum 5 MB." },
          { status: 413 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileName = file.name || "upload.xlsx";
    } else {
      const body: unknown = JSON.parse(requestBody.toString("utf8"));
      if (!body || typeof body !== "object" || !("base64Content" in body)) {
        return NextResponse.json(
          { success: false, error: "Payload tidak valid. Sertakan file multipart atau base64Content." },
          { status: 400 }
        );
      }
      const uploadBody = body as { base64Content?: unknown; fileName?: unknown };
      if (typeof uploadBody.base64Content === "string") {
        fileBuffer = Buffer.from(uploadBody.base64Content, "base64");
        fileName = typeof uploadBody.fileName === "string" ? uploadBody.fileName : "upload.xlsx";
      } else {
        return NextResponse.json(
          { success: false, error: "Payload tidak valid. Sertakan file multipart atau base64Content." },
          { status: 400 }
        );
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "File kosong atau tidak dapat dibaca." },
        { status: 400 }
      );
    }

    if (fileBuffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: "Ukuran file melebihi batas maksimum 5 MB." },
        { status: 413 }
      );
    }

    // 1. Parse and validate file content
    const parsedSummary = parseCrmLeadsFile(fileBuffer);

    if (parsedSummary.totalRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Spreadsheet tidak memiliki baris data atau format kolom tidak cocok dengan template.",
          summary: parsedSummary,
        },
        { status: 400 }
      );
    }

    // If client only requested validation/preview
    if (validateOnly) {
      return NextResponse.json({
        success: true,
        fileName,
        validateOnly: true,
        summary: parsedSummary,
      });
    }

    // 2. Commit valid rows to database
    const validLeads = parsedSummary.rows
      .filter((r) => r.valid && r.data)
      .map((r) => r.data!);

    if (validLeads.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Tidak ada baris data valid yang dapat diimpor. Periksa kolom Nama dan Nomor WhatsApp.",
          summary: parsedSummary,
        },
        { status: 400 }
      );
    }

    const importResult = await importCrmLeadsToDatabase({
      organizationId,
      leads: validLeads,
      supabase,
    });

    return NextResponse.json({
      success: importResult.success,
      fileName,
      validateOnly: false,
      summary: parsedSummary,
      importResult,
    });
  } catch (error) {
    if (error instanceof UploadTooLargeError) {
      return NextResponse.json(
        { success: false, error: "Ukuran file melebihi batas maksimum 5 MB." },
        { status: 413 }
      );
    }
    const errorMsg = error instanceof Error ? error.message : "Kesalahan server saat memproses file.";
    return NextResponse.json(
      { success: false, error: "Gagal memproses upload CRM: " + errorMsg },
      { status: 500 }
    );
  }
}
