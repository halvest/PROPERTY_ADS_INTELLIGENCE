import os
import asyncio
import logging
import urllib.parse
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from supabase import create_client, Client

from cos_uploader import download_and_upload_to_cos
from funnel_parser import parse_funnel_metadata
from graphql_extractor import extract_ads_from_graphql

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("scraper_worker")

WORKER_API_SECRET = os.getenv("WORKER_API_SECRET", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Concurrency guard: limit to 1 active Chromium instance to prevent OOM on 1.9GB RAM VPS
SCRAPE_SEMAPHORE = asyncio.Semaphore(1)

_supabase: Optional[Client] = None

def get_supabase() -> Optional[Client]:
    global _supabase
    if _supabase is None and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        try:
            _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
    return _supabase

app = FastAPI(
    title="Meta Ad Library Indonesian Property Scraper Worker",
    version="1.0.0",
    description="Microservice for Tencent Cloud Lighthouse to intercept Meta Ad Library GraphQL and persist to Tencent COS & Supabase."
)

class ScrapeRequest(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=100, description="Property keyword to spy, e.g., 'rumah bsd city'")
    country: str = Field(default="ID", pattern=r"^[A-Z]{2}$", description="Target ISO 2-letter country code")
    active_status: str = Field(default="active", pattern=r"^(active|all)$", description="active | all")
    max_scrolls: int = Field(default=5, ge=1, le=20, description="Number of smooth scroll actions (1-20)")
    job_id: Optional[str] = Field(default=None, description="UUID of the ad_scrape_jobs row")

def verify_secret(x_worker_secret: Optional[str] = Header(None)):
    if not WORKER_API_SECRET:
        logger.error("WORKER_API_SECRET is not configured on the worker server.")
        raise HTTPException(
            status_code=503,
            detail="Worker authentication is not configured."
        )
    if x_worker_secret != WORKER_API_SECRET:
        logger.warning("Unauthorized access attempt: invalid or missing X-Worker-Secret header.")
        raise HTTPException(
            status_code=401,
            detail="Invalid X-Worker-Secret header."
        )
    return True

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "has_cos": bool(os.getenv("TENCENT_COS_SECRET_ID")),
        "has_supabase": bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY),
        "auth_configured": bool(WORKER_API_SECRET),
    }

async def execute_scraping_task(req: ScrapeRequest):
    sb = get_supabase()
    keyword = req.keyword.strip()
    logger.info(f"Starting Meta Ad Library scraping for keyword: '{keyword}' (Job ID: {req.job_id})")

    verified_user_id = None
    verified_org_id = None

    # Crucial security: retrieve owner identity exclusively from verified database job, NOT client payload
    if sb and req.job_id:
        try:
            job_row = sb.table("ad_scrape_jobs").select("user_id, organization_id").eq("id", req.job_id).single().execute()
            if job_row.data:
                verified_user_id = job_row.data.get("user_id")
                verified_org_id = job_row.data.get("organization_id")
                logger.info(f"Verified owner for job {req.job_id}: user={verified_user_id}, org={verified_org_id}")
            else:
                logger.warning(f"Job {req.job_id} not found in database; cannot verify owner.")
        except Exception as e:
            logger.warning(f"Failed to query verified owner for job {req.job_id}: {e}")

    # Update job status to RUNNING
    if sb and req.job_id:
        try:
            sb.table("ad_scrape_jobs").update({"status": "RUNNING"}).eq("id", req.job_id).execute()
        except Exception as e:
            logger.warning(f"Failed to update job status to RUNNING: {e}")

    intercepted_payloads: List[Any] = []

    # Acquire semaphore to guarantee max 1 concurrent Chromium instance on 1.9GB RAM VPS
    async with SCRAPE_SEMAPHORE:
        async with async_playwright() as p:
            browser = None
            context = None
            try:
                # Launch Chromium with stealth & low-memory arguments
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-accelerated-2d-canvas",
                        "--no-first-run",
                        "--no-zygote",
                        "--disable-gpu",
                        "--hide-scrollbars",
                        "--mute-audio",
                        "--disable-background-networking",
                        "--js-flags=--max-old-space-size=512",
                    ]
                )

                context = await browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
                    ),
                    locale="id-ID",
                    timezone_id="Asia/Jakarta",
                    viewport={"width": 1280, "height": 900},
                )

                page = await context.new_page()

                # Intercept GraphQL responses from Meta Ad Library
                async def handle_response(response):
                    if "api/graphql" in response.url:
                        try:
                            data = await response.json()
                            intercepted_payloads.append(data)
                        except Exception:
                            pass

                page.on("response", handle_response)

                encoded_keyword = urllib.parse.quote_plus(keyword)
                target_url = (
                    f"https://www.facebook.com/ads/library/"
                    f"?active_status={req.active_status}&ad_type=all&country={req.country}"
                    f"&q={encoded_keyword}&search_type=keyword_unordered&media_type=all"
                )

                logger.info(f"Navigating to Meta Ad Library: {target_url}")

                try:
                    await page.goto(target_url, wait_until="networkidle", timeout=45000)
                except Exception as e:
                    logger.warning(f"Page goto timeout/error (continuing with partial data): {e}")

                # Smooth scrolling to trigger lazy loading of more ads
                for scroll_i in range(req.max_scrolls):
                    logger.info(f"Scrolling ({scroll_i + 1}/{req.max_scrolls})...")
                    await page.evaluate("window.scrollBy(0, 1000)")
                    await asyncio.sleep(2.0)

                # Allow trailing GraphQL responses to settle
                await asyncio.sleep(3.0)
            except Exception as exc:
                logger.error(f"Error during browser execution: {exc}")
            finally:
                if context:
                    try:
                        await context.close()
                    except Exception:
                        pass
                if browser:
                    try:
                        await browser.close()
                    except Exception:
                        pass

    logger.info(f"Captured {len(intercepted_payloads)} GraphQL payloads. Parsing ad units...")

    # Extract ads from intercepted payloads
    all_raw_ads: List[Dict[str, Any]] = []
    for payload in intercepted_payloads:
        extracted = extract_ads_from_graphql(payload, keyword=keyword)
        all_raw_ads.extend(extracted)

    # Deduplicate by ad_archive_id
    unique_ads_map: Dict[str, Dict[str, Any]] = {}
    for ad in all_raw_ads:
        unique_ads_map[ad["ad_archive_id"]] = ad

    parsed_ads = list(unique_ads_map.values())
    logger.info(f"Found {len(parsed_ads)} unique competitor ads for keyword '{keyword}'")

    # Process and upload media to Tencent COS & classify funnel
    final_records: List[Dict[str, Any]] = []

    for ad in parsed_ads:
        ad_id = ad["ad_archive_id"]
        raw_items = ad.pop("raw_media_items", [])
        cos_media_urls = []

        # Download & upload media to Tencent COS
        for idx, item in enumerate(raw_items):
            src_url = item.get("url")
            m_type = item.get("type", "image")
            if src_url:
                permanent_url = await download_and_upload_to_cos(
                    source_url=src_url,
                    ad_archive_id=ad_id,
                    media_type=m_type,
                    index=idx
                )
                cos_media_urls.append({
                    "type": m_type,
                    "url": permanent_url,
                    "width": item.get("width"),
                    "height": item.get("height"),
                })

        ad["cos_media_urls"] = cos_media_urls

        # Parse funnel & WhatsApp script
        funnel_info = parse_funnel_metadata(
            cta_type=ad.get("cta_type"),
            cta_text=ad.get("cta_text"),
            link_url=ad.get("destination_url")
        )
        ad["funnel_type"] = funnel_info["funnel_type"]
        ad["decoded_wa_number"] = funnel_info["decoded_wa_number"]
        ad["decoded_wa_text"] = funnel_info["decoded_wa_text"]
        ad["destination_domain"] = funnel_info["destination_domain"]

        # Associate with verified owner and job
        ad["user_id"] = verified_user_id
        ad["organization_id"] = verified_org_id
        ad["scrape_job_id"] = req.job_id

        final_records.append(ad)

    # Persist batch to Supabase
    if sb and final_records:
        try:
            logger.info(f"Upserting {len(final_records)} competitor ads to Supabase for owner {verified_user_id}...")
            sb.table("scraped_competitor_ads").upsert(
                final_records,
                on_conflict="user_id, ad_archive_id"
            ).execute()
            logger.info("Supabase upsert completed successfully.")
        except Exception as e:
            logger.error(f"Failed to upsert ads to Supabase: {e}")

    # Complete job record
    if sb and req.job_id:
        try:
            sb.table("ad_scrape_jobs").update({
                "status": "COMPLETED",
                "total_ads_found": len(final_records),
                "completed_at": "now()",
            }).eq("id", req.job_id).execute()
        except Exception as e:
            logger.warning(f"Failed to update job status to COMPLETED: {e}")

    return {
        "keyword": keyword,
        "total_ads": len(final_records),
        "status": "COMPLETED"
    }

@app.post("/api/v1/scrape", dependencies=[Depends(verify_secret)])
async def trigger_scrape(req: ScrapeRequest, background_tasks: BackgroundTasks):
    """
    Triggers an asynchronous scraping job for Meta Ad Library Indonesia.
    """
    background_tasks.add_task(execute_scraping_task, req)
    return {
        "success": True,
        "message": f"Scraper worker queued for keyword '{req.keyword}'",
        "job_id": req.job_id,
        "country": req.country,
    }
