import type { AttributionStatus } from "@/domain/attribution/types";

/**
 * Property Ads Intelligence - WhatsApp Cloud API Types
 * Official Meta WhatsApp Cloud API (v21.0) webhook schemas, referral structures, and domain models.
 */

export interface WhatsAppReferral {
  source_type: "ad" | "post";
  source_id: string; // The official Meta Ad ID (e.g. "ad_sapphire_72" or numeric string)
  source_url?: string;
  headline?: string;
  body?: string;
  media_type?: string;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
}

export interface WhatsAppMessageText {
  body: string;
}

export interface WhatsAppMessage {
  from: string; // Sender phone number in international format, e.g. "6281298765432"
  id: string; // Unique provider message ID, e.g. "wamid.HBgMNjI4MTI..."
  timestamp: string; // Unix timestamp string, e.g. "1729930000"
  type: "text" | "image" | "document" | "interactive" | "button" | "unknown";
  text?: WhatsAppMessageText;
  referral?: WhatsAppReferral;
  context?: {
    from?: string;
    id?: string;
  };
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string; // e.g. "6281298765432"
}

export interface WhatsAppStatusUpdate {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message: string }>;
}

export interface WhatsAppMessageEcho {
  from: string; // Business phone number sending the manual response
  to: string; // Prospective buyer phone number
  id: string; // wamid
  timestamp: string;
  type: "text" | "image" | "document" | "interactive" | "unknown";
  text?: WhatsAppMessageText;
}

export interface WhatsAppHistoryMessage {
  from: string;
  to?: string;
  id: string;
  timestamp: string;
  type: string;
  text?: WhatsAppMessageText;
}

export interface WhatsAppWebhookValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatusUpdate[];
  smb_message_echoes?: WhatsAppMessageEcho[];
  history?: WhatsAppHistoryMessage[];
  errors?: Array<{ code: number; title: string; message: string }>;
}

export interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue;
  field: "messages" | "smb_message_echoes" | "smb_app_state_sync" | "message_template_status_update" | string;
}

export interface WhatsAppWebhookEntry {
  id: string; // WhatsApp Business Account (WABA) ID
  changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account";
  entry: WhatsAppWebhookEntry[];
}

export interface WhatsAppConfig {
  verifyToken: string;
  appSecret: string;
  /** @deprecated Customer credentials must be provisioned per-tenant via Embedded Signup, not global env */
  phoneNumberId?: string;
  /** @deprecated Customer credentials must be provisioned per-tenant via Embedded Signup, not global env */
  businessAccountId?: string;
  /** @deprecated Customer credentials must be provisioned per-tenant via Embedded Signup, not global env */
  accessToken?: string;
  appId?: string;
  embeddedSignupConfigId?: string;
  isConfigured: boolean;
}

export interface TenantWhatsAppCredentials {
  organizationId: string;
  connectionId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  accessToken: string;
  coexistenceEnabled: boolean;
  connectionStatus: WhatsAppConnectionStatus;
}

export type WhatsAppConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "reconnect_required";

export interface WhatsAppConnectionRecord {
  id: string;
  organizationId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  connectionStatus: WhatsAppConnectionStatus;
  coexistenceEnabled: boolean;
  metadata: Record<string, unknown>;
  connectedBy: string | null;
  lastWebhookReceivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboundProcessingResult {
  status: "processed" | "ignored" | "duplicate" | "failed";
  processedMessagesCount: number;
  duplicateMessagesCount: number;
  echoMessagesCount?: number;
  historyMessagesCount?: number;
  contactId?: string;
  conversationId?: string;
  attributionStatus: AttributionStatus;
  adId?: string | null;
  providerAdId?: string | null;
  error?: string;
  isLiveVerified: boolean;
}

export type WhatsAppIntegrationStatus = "not_configured" | "mock" | "configured" | "live_verified";

