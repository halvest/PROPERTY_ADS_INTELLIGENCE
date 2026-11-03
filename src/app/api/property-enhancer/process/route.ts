import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { analyzeArchitecturalImage } from "@/lib/ai/property-enhancer/analyzer";
import { ArchitecturalEnhancerService } from "@/lib/ai/property-enhancer/enhancer-service";
import { evaluateEnhancementQuality } from "@/lib/ai/property-enhancer/quality-checker";
import { DEFAULT_STRUCTURE_LOCK } from "@/lib/ai/property-enhancer/presets";
import type {
  EnhancementMode,
  PhotographyStyle,
  EnhancementIntensity,
  OutputAspectRatio,
  ArchitecturalStructureLock,
  EnhancementJobResult,
} from "@/lib/ai/property-enhancer/types";

export const maxDuration = 60; // Generative requests take 8-30s

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Autentikasi diperlukan untuk mengakses Architectural Photo Enhancer" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId = profile?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "Profil organisasi aktif diperlukan" },
        { status: 400 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let fileBuffer: Buffer | null = null;
    let fileName = "architectural_render.jpg";
    let mimeType = "image/jpeg";
    let mode: EnhancementMode = "mode_photorealistic";
    let style: PhotographyStyle = "style_clean_daylight";
    let intensity: EnhancementIntensity = "balanced";
    let aspectRatio: OutputAspectRatio = "original";
    let structureLock: ArchitecturalStructureLock = { ...DEFAULT_STRUCTURE_LOCK };
    let detailNotes = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: "File gambar render properti tidak ditemukan" },
          { status: 400 }
        );
      }

      // Validasi ukuran (maks 25MB)
      if (file.size > 25 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: "Ukuran file melebihi batas 25MB" },
          { status: 400 }
        );
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: "Format gambar tidak didukung. Harap gunakan JPG, PNG, atau WEBP." },
          { status: 400 }
        );
      }

      fileName = file.name;
      mimeType = file.type;
      fileBuffer = Buffer.from(await file.arrayBuffer());

      mode = (formData.get("mode") as EnhancementMode) || "mode_photorealistic";
      style = (formData.get("style") as PhotographyStyle) || "style_clean_daylight";
      intensity = (formData.get("intensity") as EnhancementIntensity) || "balanced";
      aspectRatio = (formData.get("aspectRatio") as OutputAspectRatio) || "original";
      detailNotes = (formData.get("detailNotes") as string) || "";

      const rawLock = formData.get("structureLock") as string | null;
      if (rawLock) {
        try {
          structureLock = { ...structureLock, ...JSON.parse(rawLock) };
        } catch {
          // Keep defaults
        }
      }
    } else {
      // JSON payload
      const body = await req.json();
      mode = body.mode || "mode_photorealistic";
      style = body.style || "style_clean_daylight";
      intensity = body.intensity || "balanced";
      aspectRatio = body.aspectRatio || "original";
      detailNotes = body.detailNotes || "";
      if (body.structureLock) {
        structureLock = { ...structureLock, ...body.structureLock };
      }

      if (body.imageUrl) {
        const imgRes = await fetch(body.imageUrl);
        if (!imgRes.ok) {
          return NextResponse.json(
            { success: false, error: "Gagal mengunduh gambar sumber dari URL" },
            { status: 400 }
          );
        }
        fileBuffer = Buffer.from(await imgRes.arrayBuffer());
        fileName = body.fileName || "remote_render.jpg";
      } else {
        return NextResponse.json(
          { success: false, error: "Data gambar tidak ditemukan dalam permintaan" },
          { status: 400 }
        );
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { success: false, error: "Buffer gambar kosong" },
        { status: 400 }
      );
    }

    // Step 1: Intelligent Architectural Image Analysis (Phase 6)
    const analysis = await analyzeArchitecturalImage(fileBuffer);

    // Step 2: Real Meta Muse Image-to-Image Architectural Enhancement (Phase 3 & 5)
    const serviceResult = await ArchitecturalEnhancerService.enhance({
      imageBuffer: fileBuffer,
      mimeType,
      mode,
      style,
      intensity,
      aspectRatio,
      structureLock,
      analysis,
      detailNotes,
    });

    // Step 3: Visual Quality Control & Scorecard (Phase 7)
    const scorecard = await evaluateEnhancementQuality(
      fileBuffer,
      serviceResult.enhancedBuffer,
      analysis,
      mode,
      serviceResult.isSimulated
    );

    // Step 4: Storage & History Archiving
    const timestamp = Date.now();
    const sanitizedBase = fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const originalPath = `enhancements/${organizationId}/${timestamp}_orig_${sanitizedBase}.jpg`;
    const enhancedPath = `enhancements/${organizationId}/${timestamp}_enh_${sanitizedBase}.jpg`;

    let originalUrl = "";
    let enhancedUrl = "";

    try {
      const { error: origUploadErr } = await supabase.storage
        .from("property-creatives")
        .upload(originalPath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      const { error: enhUploadErr } = await supabase.storage
        .from("property-creatives")
        .upload(enhancedPath, serviceResult.enhancedBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (!origUploadErr && !enhUploadErr) {
        const { data: origUrlData } = supabase.storage
          .from("property-creatives")
          .getPublicUrl(originalPath);
        const { data: enhUrlData } = supabase.storage
          .from("property-creatives")
          .getPublicUrl(enhancedPath);

        originalUrl = origUrlData.publicUrl;
        enhancedUrl = enhUrlData.publicUrl;
      } else {
        originalUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
        enhancedUrl = `data:image/jpeg;base64,${serviceResult.enhancedBuffer.toString("base64")}`;
      }
    } catch {
      originalUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
      enhancedUrl = `data:image/jpeg;base64,${serviceResult.enhancedBuffer.toString("base64")}`;
    }

    const resultId = `enh_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

    // Record into property_image_enhancements table
    try {
      await supabase.from("property_image_enhancements").insert({
        id: resultId,
        organization_id: organizationId,
        user_id: user.id,
        original_image_path: originalPath,
        original_image_url: originalUrl,
        enhanced_image_path: enhancedPath,
        enhanced_image_url: enhancedUrl,
        original_width: analysis.width,
        original_height: analysis.height,
        output_width: serviceResult.enhancedWidth,
        output_height: serviceResult.enhancedHeight,
        file_name: fileName,
        file_size: fileBuffer.length,
        enhanced_file_size: serviceResult.enhancedFileSize,
        mime_type: mimeType,
        enhancement_mode: mode,
        preset: style,
        intensity: intensity === "conservative" ? 30 : intensity === "advanced" ? 80 : 50,
        processing_status: "completed",
        processing_config: {
          mode,
          style,
          intensity,
          aspectRatio,
          structureLock,
        } as unknown as Json,
        processing_metadata: {
          scorecard,
          aiReasoning: serviceResult.aiReasoning,
          modelUsed: serviceResult.modelUsed,
          provider: serviceResult.provider,
          isSimulated: serviceResult.isSimulated,
        } as unknown as Json,
        scene_category: analysis.buildingType,
      });
    } catch (dbErr) {
      console.warn("[Architectural Enhancer] DB log error:", dbErr);
    }

    const payload: EnhancementJobResult = {
      id: resultId,
      originalUrl,
      enhancedUrl,
      originalWidth: analysis.width,
      originalHeight: analysis.height,
      enhancedWidth: serviceResult.enhancedWidth,
      enhancedHeight: serviceResult.enhancedHeight,
      originalFileSize: fileBuffer.length,
      enhancedFileSize: serviceResult.enhancedFileSize,
      mode,
      style,
      intensity,
      aspectRatio,
      structureLock,
      analysis,
      scorecard,
      modelUsed: serviceResult.modelUsed,
      provider: serviceResult.provider,
      aiReasoning: serviceResult.aiReasoning,
      processingTimeMs: serviceResult.processingTimeMs,
      status: "completed",
      isSimulated: serviceResult.isSimulated,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: payload,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan internal saat enhancement foto arsitektur";
    console.error("[Architectural Enhancer Error]:", err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
