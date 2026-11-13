import datetime
import math
from typing import List, Dict, Any, Optional

def calculate_longevity(start_date_ts: Optional[int], end_date_ts: Optional[int], is_active: bool) -> tuple[int, str]:
    """
    Computes active_days_count and longevity_phase (TESTING, VALIDATING, EVERGREEN)
    based on start_date and current time / end_date.
    """
    if not start_date_ts:
        return 1, "TESTING"

    now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    target_end_ts = now_ts if is_active or not end_date_ts else end_date_ts

    diff_seconds = max(0, target_end_ts - start_date_ts)
    active_days = max(1, math.ceil(diff_seconds / 86400))

    if active_days >= 15:
        phase = "EVERGREEN"
    elif active_days >= 5:
        phase = "VALIDATING"
    else:
        phase = "TESTING"

    return active_days, phase

def parse_iso_or_epoch(val: Any) -> Optional[str]:
    if not val:
        return None
    try:
        if isinstance(val, (int, float)):
            dt = datetime.datetime.fromtimestamp(val, tz=datetime.timezone.utc)
            return dt.isoformat()
        if isinstance(val, str):
            if val.isdigit():
                dt = datetime.datetime.fromtimestamp(int(val), tz=datetime.timezone.utc)
                return dt.isoformat()
            return val
    except Exception:
        pass
    return None

def extract_ads_from_graphql(payload: Any, keyword: str = "") -> List[Dict[str, Any]]:
    """
    Recursively scans the Meta Ad Library /api/graphql/ response payload
    to locate ad items, collation groups, and snapshots.
    """
    ads: List[Dict[str, Any]] = []

    def walk(obj: Any):
        if isinstance(obj, dict):
            # Check for Ad Archive item structure
            if "ad_archive_id" in obj or "archive_id" in obj:
                extracted = parse_ad_node(obj, keyword)
                if extracted:
                    ads.append(extracted)
            elif "edges" in obj and isinstance(obj["edges"], list):
                for edge in obj["edges"]:
                    if isinstance(edge, dict) and "node" in edge:
                        extracted = parse_ad_node(edge["node"], keyword)
                        if extracted:
                            ads.append(extracted)
                        else:
                            walk(edge["node"])
                    else:
                        walk(edge)
            else:
                for k, v in obj.items():
                    walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(payload)

    # Deduplicate by ad_archive_id
    seen = set()
    unique_ads = []
    for a in ads:
        if a["ad_archive_id"] not in seen:
            seen.add(a["ad_archive_id"])
            unique_ads.append(a)

    return unique_ads

def parse_ad_node(node: Dict[str, Any], keyword: str) -> Optional[Dict[str, Any]]:
    """
    Parses a single GraphQL ad node into a standardized dictionary.
    """
    ad_id = str(node.get("ad_archive_id") or node.get("archive_id") or node.get("id") or "").strip()
    if not ad_id or not ad_id.isdigit():
        return None

    page_id = str(node.get("page_id") or node.get("page", {}).get("id") or "")
    page_name = str(node.get("page_name") or node.get("page", {}).get("name") or "Pengiklan Properti")
    page_profile_uri = node.get("page_profile_uri") or node.get("page", {}).get("profile_picture_url")

    # Dates & Longevity
    start_ts = node.get("start_date") or node.get("ad_delivery_start_time")
    end_ts = node.get("end_date") or node.get("ad_delivery_stop_time")
    is_active = bool(node.get("is_active", True))

    start_iso = parse_iso_or_epoch(start_ts) or datetime.datetime.now(datetime.timezone.utc).isoformat()
    end_iso = parse_iso_or_epoch(end_ts)

    start_epoch = int(start_ts) if str(start_ts or "").isdigit() else int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    end_epoch = int(end_ts) if str(end_ts or "").isdigit() else None
    active_days, longevity_phase = calculate_longevity(start_epoch, end_epoch, is_active)

    # Collation
    collation_id = node.get("collation_id")
    collation_count = int(node.get("collation_count") or 1)

    # Snapshot parsing
    snapshot = node.get("snapshot") or {}
    body_text = ""
    if isinstance(snapshot.get("body"), dict):
        body_text = snapshot.get("body", {}).get("text", "")
    elif isinstance(snapshot.get("body"), str):
        body_text = snapshot.get("body", "")

    headline_title = snapshot.get("title") or ""
    link_description = snapshot.get("link_description") or ""
    cta_type = snapshot.get("cta_type")
    cta_text = snapshot.get("cta_text")
    destination_url = snapshot.get("link_url") or ""

    # Media Extraction
    media_format = "IMAGE"
    media_items: List[Dict[str, Any]] = []

    # 1. Videos
    videos = snapshot.get("videos") or []
    if isinstance(videos, list) and len(videos) > 0:
        media_format = "VIDEO"
        for v in videos:
            v_url = v.get("video_hd_url") or v.get("video_sd_url") or v.get("video_preview_image_url")
            if v_url:
                media_items.append({
                    "type": "video",
                    "url": v_url,
                    "preview_image": v.get("video_preview_image_url")
                })

    # 2. Images (if no video)
    if not media_items:
        images = snapshot.get("images") or []
        if isinstance(images, list) and len(images) > 0:
            media_format = "IMAGE"
            for img in images:
                img_url = img.get("original_image_url") or img.get("resized_image_url")
                if img_url:
                    media_items.append({
                        "type": "image",
                        "url": img_url,
                        "width": img.get("width"),
                        "height": img.get("height")
                    })

    # 3. Carousel cards
    cards = snapshot.get("cards") or []
    if isinstance(cards, list) and len(cards) > 1:
        media_format = "CAROUSEL"
        for idx, c in enumerate(cards):
            c_img = c.get("original_image_url") or c.get("image_url") or c.get("resized_image_url")
            if c_img:
                media_items.append({
                    "type": "image",
                    "url": c_img,
                    "card_title": c.get("title"),
                    "card_body": c.get("body")
                })

    publisher_platforms = node.get("publisher_platform") or ["facebook", "instagram"]
    if isinstance(publisher_platforms, str):
        publisher_platforms = [publisher_platforms]

    return {
        "ad_archive_id": ad_id,
        "search_keyword": keyword.strip().lower(),
        "page_id": page_id,
        "page_name": page_name,
        "page_profile_uri": page_profile_uri,
        "is_active": is_active,
        "start_date": start_iso,
        "end_date": end_iso,
        "active_days_count": active_days,
        "longevity_phase": longevity_phase,
        "collation_id": collation_id,
        "collation_count": collation_count,
        "media_format": media_format,
        "raw_media_items": media_items,
        "original_body_text": body_text,
        "headline_title": headline_title,
        "link_description": link_description,
        "cta_type": cta_type,
        "cta_text": cta_text,
        "destination_url": destination_url,
        "publisher_platforms": publisher_platforms,
    }
