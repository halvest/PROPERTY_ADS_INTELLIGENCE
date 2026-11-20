import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processPendingLeadAnalyses } from "@/lib/ai/lead-intelligence/worker";

const WorkerParamsSchema = z.object({
  debounceSeconds: z.coerce.number().int().min(0).max(86400).optional(),
  batchSize: z.coerce.number().int().min(1).max(100).optional(),
});

function timingSafeSecretEquals(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

function isAuthorizedWorkerRequest(req: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET?.trim();
  if (!expectedSecret) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const bearerToken = authHeader.slice("bearer ".length).trim();
    if (bearerToken && timingSafeSecretEquals(bearerToken, expectedSecret)) {
      return true;
    }
  }

  const workerHeader = req.headers.get("x-worker-secret")?.trim();
  if (workerHeader && timingSafeSecretEquals(workerHeader, expectedSecret)) {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedWorkerRequest(req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    let bodyParams: Record<string, unknown> = {};
    const rawBody = await req.text();
    if (rawBody.trim()) {
      try {
        const parsed = JSON.parse(rawBody);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          bodyParams = parsed as Record<string, unknown>;
        }
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON body" },
          { status: 400 }
        );
      }
    }

    const queryDebounce = req.nextUrl.searchParams.get("debounceSeconds");
    const queryBatch = req.nextUrl.searchParams.get("batchSize");

    const parsedParams = WorkerParamsSchema.safeParse({
      debounceSeconds: queryDebounce ?? bodyParams.debounceSeconds,
      batchSize: queryBatch ?? bodyParams.batchSize,
    });

    if (!parsedParams.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid worker parameters",
          details: parsedParams.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const summary = await processPendingLeadAnalyses({
      debounceSeconds: parsedParams.data.debounceSeconds ?? 120,
      batchSize: parsedParams.data.batchSize ?? 10,
    });

    return NextResponse.json({ success: true, ...summary }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Worker execution failed";
    console.error("[POST /api/workers/analyze-leads] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
