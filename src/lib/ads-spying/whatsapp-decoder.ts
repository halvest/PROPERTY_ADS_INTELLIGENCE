/**
 * Deterministic WhatsApp Link & Pre-filled Message Decoder
 * Extracts the real customer intent & pre-filled conversation script
 * from wa.me, api.whatsapp.com, or custom bit.ly redirects.
 */

export interface DecodedWhatsAppPayload {
  isWhatsApp: boolean;
  phoneNumber: string | null;
  prefilledText: string | null;
}

export function decodeWhatsAppUrl(rawUrl: string | null | undefined): DecodedWhatsAppPayload {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { isWhatsApp: false, phoneNumber: null, prefilledText: null };
  }

  const cleanUrl = rawUrl.trim();
  const isWaHost =
    cleanUrl.includes("wa.me") ||
    cleanUrl.includes("api.whatsapp.com") ||
    cleanUrl.includes("whatsapp.com/send") ||
    cleanUrl.includes("chat.whatsapp.com") ||
    cleanUrl.includes("web.whatsapp.com");

  if (!isWaHost) {
    return { isWhatsApp: false, phoneNumber: null, prefilledText: null };
  }

  let phoneNumber: string | null = null;
  let prefilledText: string | null = null;

  try {
    // 1. Try parsing standard URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`);
    } catch {
      // Fallback regex parsing
      const phoneMatch = cleanUrl.match(/(?:wa\.me\/|phone=)([0-9+]+)/i);
      if (phoneMatch) phoneNumber = cleanPhone(phoneMatch[1]);

      const textMatch = cleanUrl.match(/[?&](?:text|message)=([^&#]+)/i);
      if (textMatch) prefilledText = cleanText(textMatch[1]);

      return {
        isWhatsApp: true,
        phoneNumber,
        prefilledText,
      };
    }

    // 2. Extract Phone Number
    // From path: wa.me/628123456789
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      const candidate = pathParts[0].replace(/[^0-9]/g, "");
      if (candidate.length >= 7) {
        phoneNumber = cleanPhone(candidate);
      }
    }

    // From query param: ?phone=628123456789
    if (!phoneNumber) {
      const paramPhone = parsedUrl.searchParams.get("phone");
      if (paramPhone) {
        phoneNumber = cleanPhone(paramPhone);
      }
    }

    // 3. Extract Pre-filled Text Script
    const rawTextParam =
      parsedUrl.searchParams.get("text") ||
      parsedUrl.searchParams.get("message") ||
      parsedUrl.searchParams.get("body");

    if (rawTextParam) {
      prefilledText = cleanText(rawTextParam);
    }
  } catch {
    // Graceful regex recovery
    const phoneMatch = cleanUrl.match(/(?:wa\.me\/|phone=)([0-9+]+)/i);
    if (phoneMatch) phoneNumber = cleanPhone(phoneMatch[1]);

    const textMatch = cleanUrl.match(/[?&](?:text|message)=([^&#]+)/i);
    if (textMatch) prefilledText = cleanText(textMatch[1]);
  }

  return {
    isWhatsApp: true,
    phoneNumber,
    prefilledText,
  };
}

function cleanPhone(raw: string): string {
  let cleaned = raw.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = `62${cleaned.slice(1)}`;
  }
  return cleaned;
}

function cleanText(raw: string): string {
  try {
    // Replace '+' with space first as per x-www-form-urlencoded standard
    const spaced = raw.replace(/\+/g, " ");
    return decodeURIComponent(spaced).trim();
  } catch {
    try {
      return unescape(raw.replace(/\+/g, " ")).trim();
    } catch {
      return raw.replace(/\+/g, " ").trim();
    }
  }
}
