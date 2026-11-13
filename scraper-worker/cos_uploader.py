import os
import mimetypes
import logging
from typing import Optional
import httpx
from qcloud_cos import CosConfig, CosS3Client
from qcloud_cos.cos_exception import CosException

logger = logging.getLogger("cos_uploader")

# Load environment configuration
SECRET_ID = os.getenv("TENCENT_COS_SECRET_ID", "")
SECRET_KEY = os.getenv("TENCENT_COS_SECRET_KEY", "")
REGION = os.getenv("TENCENT_COS_REGION", "ap-jakarta")
BUCKET = os.getenv("TENCENT_COS_BUCKET", "")
PUBLIC_DOMAIN = os.getenv("TENCENT_COS_PUBLIC_DOMAIN", "").rstrip("/")

_cos_client: Optional[CosS3Client] = None

def get_cos_client() -> Optional[CosS3Client]:
    global _cos_client
    if _cos_client is None and SECRET_ID and SECRET_KEY:
        try:
            config = CosConfig(Region=REGION, SecretId=SECRET_ID, SecretKey=SECRET_KEY)
            _cos_client = CosS3Client(config)
        except Exception as e:
            logger.error(f"Failed to initialize Tencent COS client: {e}")
    return _cos_client

async def download_and_upload_to_cos(
    source_url: str,
    ad_archive_id: str,
    media_type: str = "image",
    index: int = 0
) -> str:
    """
    Downloads ephemeral media from Meta fbcdn.net and permanently stores it
    into Tencent Cloud Object Storage (COS).

    Path: ads-spy/{ad_archive_id}/{index}.{ext}
    Returns the permanent public URL.
    """
    if not source_url:
        return ""

    # If already a permanent Tencent COS URL, return directly
    if PUBLIC_DOMAIN and source_url.startswith(PUBLIC_DOMAIN):
        return source_url

    client = get_cos_client()
    if not client or not BUCKET:
        logger.warning("Tencent COS credentials not configured, retaining source URL.")
        return source_url

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        ),
        "Accept": "*/*",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
            resp = await http_client.get(source_url, headers=headers)
            if resp.status_code != 200:
                logger.error(f"Failed to fetch media from source ({resp.status_code}): {source_url}")
                return source_url

            content_type = resp.headers.get("content-type", "")
            ext = "jpg"
            if "video" in content_type or media_type == "video":
                ext = "mp4"
            elif "png" in content_type:
                ext = "png"
            elif "webp" in content_type:
                ext = "webp"
            elif "." in source_url.split("?")[0]:
                raw_ext = source_url.split("?")[0].split(".")[-1].lower()
                if raw_ext in ["jpg", "jpeg", "png", "webp", "mp4", "mov"]:
                    ext = raw_ext

            cos_key = f"ads-spy/{ad_archive_id}/{index}.{ext}"

            # Upload buffer to Tencent COS
            client.put_object(
                Bucket=BUCKET,
                Body=resp.content,
                Key=cos_key,
                ContentType=content_type or f"{media_type}/{ext}",
                EnableMD5=False
            )

            if PUBLIC_DOMAIN:
                permanent_url = f"{PUBLIC_DOMAIN}/{cos_key}"
            else:
                permanent_url = f"https://{BUCKET}.cos.{REGION}.myqcloud.com/{cos_key}"

            logger.info(f"Successfully uploaded media to COS: {permanent_url}")
            return permanent_url

    except CosException as ce:
        logger.error(f"Tencent COS upload exception: {ce}")
        return source_url
    except Exception as ex:
        logger.error(f"Unexpected error in download_and_upload_to_cos: {ex}")
        return source_url
