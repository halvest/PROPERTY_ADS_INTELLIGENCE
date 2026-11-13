import re
import urllib.parse
from typing import Dict, Any, Optional

def normalize_indonesian_phone(raw_phone: str) -> Optional[str]:
    """
    Cleans and standardizes Indonesian phone numbers into +62 format.
    """
    if not raw_phone:
        return None
    cleaned = re.sub(r"[^\d+]", "", raw_phone)
    if cleaned.startswith("+62"):
        return cleaned
    if cleaned.startswith("62"):
        return f"+{cleaned}"
    if cleaned.startswith("08"):
        return f"+62{cleaned[1:]}"
    if cleaned.startswith("8"):
        return f"+62{cleaned}"
    return cleaned if len(cleaned) >= 8 else None

def parse_funnel_metadata(
    cta_type: Optional[str] = None,
    cta_text: Optional[str] = None,
    link_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Deterministically parses funnel type, destination domain, and
    pre-filled WhatsApp chat scripts from Meta Ad CTA & destination links.
    """
    result: Dict[str, Any] = {
        "funnel_type": "UNKNOWN",
        "decoded_wa_number": None,
        "decoded_wa_text": None,
        "destination_domain": None,
        "destination_url": link_url or "",
    }

    raw_url = link_url.strip() if link_url else ""
    upper_cta = (cta_type or "").upper()
    upper_text = (cta_text or "").upper()

    # 1. Detect Click-to-WhatsApp (CTWA)
    is_wa_cta = upper_cta in ["WHATSAPP_MESSAGE", "SEND_WHATSAPP_MESSAGE"] or "WHATSAPP" in upper_text
    is_wa_url = any(domain in raw_url.lower() for domain in ["wa.me", "api.whatsapp.com", "whatsapp.com/send", "chat.whatsapp.com"])

    if is_wa_cta or is_wa_url:
        result["funnel_type"] = "CTWA"
        result["destination_domain"] = "whatsapp.com"

        if raw_url:
            try:
                parsed = urllib.parse.urlparse(raw_url)
                query_params = urllib.parse.parse_qs(parsed.query)

                # Extract script: ?text=...
                raw_script = ""
                if "text" in query_params and query_params["text"]:
                    raw_script = query_params["text"][0]

                if raw_script:
                    decoded = urllib.parse.unquote_plus(raw_script).strip()
                    # Clean escaped newlines and unicode emojis
                    decoded = re.sub(r"\\n", "\n", decoded)
                    result["decoded_wa_text"] = decoded

                # Extract phone number
                phone_candidate = ""
                if "phone" in query_params and query_params["phone"]:
                    phone_candidate = query_params["phone"][0]
                elif "wa.me/" in raw_url:
                    match = re.search(r"wa\.me/(\+?\d+)", raw_url)
                    if match:
                        phone_candidate = match.group(1)

                if phone_candidate:
                    result["decoded_wa_number"] = normalize_indonesian_phone(phone_candidate)

            except Exception:
                pass

        return result

    # 2. Detect Lead Form (Meta Instant Form)
    if upper_cta in ["LEAD_GEN", "SIGN_UP", "APPLY_NOW"] or "form" in raw_url.lower() or "fb.me" in raw_url.lower():
        result["funnel_type"] = "LEAD_FORM"
        result["destination_domain"] = "meta.com"
        return result

    # 3. Detect Instagram Direct
    if "instagram.com/direct" in raw_url.lower() or upper_cta == "INSTAGRAM_MESSAGE":
        result["funnel_type"] = "IG_DIRECT"
        result["destination_domain"] = "instagram.com"
        return result

    # 4. Detect Facebook Messenger
    if "m.me/" in raw_url.lower() or upper_cta == "MESSAGE_PAGE":
        result["funnel_type"] = "MESSENGER"
        result["destination_domain"] = "messenger.com"
        return result

    # 5. Detect External Landing Page
    if raw_url.startswith("http://") or raw_url.startswith("https://"):
        result["funnel_type"] = "LANDING_PAGE"
        try:
            parsed = urllib.parse.urlparse(raw_url)
            domain = parsed.netloc.lower()
            if domain.startswith("www."):
                domain = domain[4:]
            result["destination_domain"] = domain
        except Exception:
            result["destination_domain"] = "external"
        return result

    result["funnel_type"] = "OTHER"
    return result
