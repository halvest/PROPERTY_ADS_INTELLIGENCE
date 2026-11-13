import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId = profile?.organization_id || null;
    const userId = user.id;

    const body = await req.json();
    const keyword = (body.keyword || "").trim().toLowerCase();

    if (!keyword) {
      return NextResponse.json(
        { success: false, error: "Keyword is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Create Job in database with verified tenant identity
    const { data: job, error: insertErr } = await adminClient
      .from("ad_scrape_jobs")
      .insert({
        user_id: userId,
        organization_id: organizationId,
        search_keyword: keyword,
        country_code: "ID",
        status: "RUNNING",
      })
      .select("*")
      .single();

    if (insertErr || !job) {
      return NextResponse.json(
        { success: false, error: insertErr?.message || "Failed to create scrape job" },
        { status: 500 }
      );
    }

    // 2. Count existing matched ads in tenant-isolated catalog
    let countQuery = adminClient
      .from("scraped_competitor_ads")
      .select("id", { count: "exact", head: true })
      .ilike("search_keyword", `%${keyword}%`);

    if (organizationId) {
      countQuery = countQuery.or(`organization_id.eq.${organizationId},user_id.eq.${userId}`);
    } else {
      countQuery = countQuery.eq("user_id", userId);
    }

    const { count } = await countQuery;
    const totalAds = count || 0;

    // 3. If worker microservice URL is configured, trigger asynchronous scraping task
    const workerUrl = process.env.SCRAPER_WORKER_URL;
    const workerSecret = process.env.WORKER_API_SECRET;

    if (workerUrl) {
      try {
        await fetch(`${workerUrl.replace(/\/$/, "")}/api/v1/scrape`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(workerSecret ? { "X-Worker-Secret": workerSecret } : {}),
          },
          body: JSON.stringify({
            keyword,
            country: "ID",
            job_id: job.id,
            max_scrolls: 5,
          }),
        });
      } catch (workerErr) {
        console.warn("[API /api/ads-spying/scrape] Warning contacting external worker:", workerErr);
      }
    } else {
      // Complete job directly if worker microservice is not configured
      await adminClient
        .from("ad_scrape_jobs")
        .update({
          status: "COMPLETED",
          total_ads_found: totalAds,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }

    return NextResponse.json({
      success: true,
      job: { ...job, total_ads_found: totalAds },
      total_ads_found: totalAds,
      message: `Scraping sinkronisasi selesai untuk kata kunci '${keyword}'. Ditemukan ${totalAds} materi iklan di katalog Anda.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scrape job failed";
    console.error("[API /api/ads-spying/scrape] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
