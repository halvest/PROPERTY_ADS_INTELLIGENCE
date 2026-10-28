import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";

/**
 * Property Ads Intelligence - Synthetic WhatsApp Cloud API Webhook Fixtures
 * Conforming strictly to official Meta WhatsApp Cloud API v21.0 webhook event schemas.
 */

// 1. Inbound message with official Click-to-WhatsApp referral metadata (Verified)
export const MOCK_WHATSAPP_VERIFIED_REFERRAL_PAYLOAD: WhatsAppWebhookPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba_1029384756",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "+62 812-9999-0001",
              phone_number_id: "109876543210987",
            },
            contacts: [
              {
                profile: { name: "Budi Santoso" },
                wa_id: "6281298765432",
              },
            ],
            messages: [
              {
                from: "6281298765432",
                id: "wamid.HBgMNjI4MTI5ODc2NTQzMhUCMRIAEgkxMjM0NTY3ODkA",
                timestamp: "1729930000",
                type: "text",
                text: {
                  body: "Halo, saya tertarik dengan Cluster Sapphire BSD Tipe 72 Hook. Apakah masih ada unit?",
                },
                referral: {
                  source_type: "ad",
                  source_id: "ad_sapphire_72",
                  source_url: "https://fb.me/sapphire-bsd-promo",
                  headline: "Cluster Sapphire BSD - Tipe 72 Hook Siap Huni",
                  body: "Promo DP 0% Cicilan Ringan",
                  media_type: "image",
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

// 2. Inbound message without referral but matching campaign headline (Inferred)
export const MOCK_WHATSAPP_INFERRED_PAYLOAD: WhatsAppWebhookPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba_1029384756",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "+62 812-9999-0001",
              phone_number_id: "109876543210987",
            },
            contacts: [
              {
                profile: { name: "Siti Rahma" },
                wa_id: "6281312345678",
              },
            ],
            messages: [
              {
                from: "6281312345678",
                id: "wamid.HBgMNjI4MTMxMjM0NTY3OBICMRIAEgkyMzQ1Njc4OTA=",
                timestamp: "1729931200",
                type: "text",
                text: {
                  body: "Selamat siang, saya lihat iklan Cluster Sapphire BSD di Instagram. Promo DP 0% masih berlaku?",
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

// 3. Organic inquiry without ad referral or campaign match (Unknown)
export const MOCK_WHATSAPP_ORGANIC_PAYLOAD: WhatsAppWebhookPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba_1029384756",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "+62 812-9999-0001",
              phone_number_id: "109876543210987",
            },
            contacts: [
              {
                profile: { name: "Hendra Wijaya" },
                wa_id: "6281598765432",
              },
            ],
            messages: [
              {
                from: "6281598765432",
                id: "wamid.HBgMNjI4MTU5ODc2NTQzMhICMRIAEgkzNDU2Nzg5MDE=",
                timestamp: "1729932400",
                type: "text",
                text: {
                  body: "Halo, saya dapat nomor ini dari teman saya. Mau tanya info properti di Tangerang Selatan.",
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

// 4. Status update notification (no messages)
export const MOCK_WHATSAPP_STATUS_UPDATE_PAYLOAD: WhatsAppWebhookPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba_1029384756",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "+62 812-9999-0001",
              phone_number_id: "109876543210987",
            },
            statuses: [
              {
                id: "wamid.HBgMNjI4MTI5ODc2NTQzMhUCMRIAEgkxMjM0NTY3ODkA",
                status: "delivered",
                timestamp: "1729930015",
                recipient_id: "6281298765432",
              },
            ],
          },
        },
      ],
    },
  ],
};
