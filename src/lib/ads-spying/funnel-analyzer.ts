import type { FunnelType } from "./types";
import { decodeWhatsAppUrl, type DecodedWhatsAppPayload } from "./whatsapp-decoder";

export interface AnalyzedFunnel {
  funnel_type: FunnelType;
  destination_domain: string | null;
  decoded_wa: DecodedWhatsAppPayload;
}

export function analyzeAdFunnel(params: {
  destination_url?: string | null;
  cta_type?: string | null;
  cta_text?: string | null;
}): AnalyzedFunnel {
  const url = (params.destination_url || "").trim();
  const ctaType = (params.cta_type || "").toUpperCase();
  const ctaText = (params.cta_text || "").toLowerCase();

  // 1. WhatsApp CTWA Detection
  const wa = decodeWhatsAppUrl(url);
  const isCtaWa =
    ctaType.includes("WHATSAPP") ||
    ctaText.includes("whatsapp") ||
    ctaText.includes("kirim pesan whatsapp") ||
    ctaText.includes("hubungi via wa");

  if (wa.isWhatsApp || isCtaWa) {
    return {
      funnel_type: "CTWA",
      destination_domain: "wa.me",
      decoded_wa: wa,
    };
  }

  // 2. Lead Form (Meta Instant Forms)
  const isLeadForm =
    url.includes("facebook.com/lead_gen") ||
    url.includes("fb.me/lead") ||
    ctaType === "LEAD_GEN" ||
    ctaType === "APPLY_NOW" ||
    ctaType === "SIGN_UP" && (url.includes("facebook.com") || url.includes("fb.me"));

  if (isLeadForm) {
    return {
      funnel_type: "LEAD_FORM",
      destination_domain: "facebook.com (Instant Form)",
      decoded_wa: wa,
    };
  }

  // 3. Instagram Direct
  if (url.includes("instagram.com/direct") || ctaType === "INSTAGRAM_MESSAGE") {
    return {
      funnel_type: "IG_DIRECT",
      destination_domain: "instagram.com",
      decoded_wa: wa,
    };
  }

  // 4. Messenger
  if (url.includes("m.me/") || url.includes("messenger.com") || ctaType === "MESSAGE_PAGE") {
    return {
      funnel_type: "MESSENGER",
      destination_domain: "messenger.com",
      decoded_wa: wa,
    };
  }

  // 5. External Landing Page
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, "");
      return {
        funnel_type: "LANDING_PAGE",
        destination_domain: host,
        decoded_wa: wa,
      };
    } catch {
      return {
        funnel_type: "LANDING_PAGE",
        destination_domain: url.split("/")[0] || null,
        decoded_wa: wa,
      };
    }
  }

  return {
    funnel_type: "UNKNOWN",
    destination_domain: null,
    decoded_wa: wa,
  };
}
