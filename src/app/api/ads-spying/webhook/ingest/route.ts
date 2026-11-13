import { NextResponse } from "next/server";
import { AdsSpyingService } from "@/lib/ads-spying/service";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("x-scraper-secret") || req.headers.get("x-worker-secret");
    const configuredSecret = process.env.WORKER_API_SECRET || process.env.SCRAPER_WEBHOOK_SECRET;

    // Fail-closed secret validation
    if (!configuredSecret) {
      return NextResponse.json(
        { success: false, error: "Webhook authentication is not configured on the server" },
        { status: 503 }
      );
    }

    if (authHeader !== configuredSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid secret header" },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (!body.keyword || !Array.isArray(body.ads)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload: 'keyword' and 'ads' array required" },
        { status: 400 }
      );
    }

    // Require job_id to guarantee tenant identity cannot be fabricated by client
    if (!body.job_id) {
      return NextResponse.json(
        { success: false, error: "job_id is required to resolve verified tenant identity" },
        { status: 400 }
      );
    }

    const result = await AdsSpyingService.ingestScrapedAds({
      keyword: body.keyword,
      ads: body.ads,
      jobId: body.job_id,
    });

    return NextResponse.json({
      success: true,
      ingestedCount: result.ingestedCount,
      message: `Successfully ingested ${result.ingestedCount} ads from Tencent Cloud scraper.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    console.error("[API /api/ads-spying/webhook/ingest] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
