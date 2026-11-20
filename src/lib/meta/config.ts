export interface MetaPublicConfig {
  appId: string;
  embeddedSignupConfigId: string;
  graphApiVersion: string;
}

export interface MetaServerConfig extends MetaPublicConfig {
  appSecret: string;
  whatsappTokenEncryptionKey: string;
}

function readRequiredEnv(name: string, value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return trimmed;
}

export function getMetaGraphApiVersion(): string {
  const version = (process.env.META_GRAPH_API_VERSION ?? "v26.0").trim();
  return version || "v26.0";
}

/**
 * Returns public Meta Embedded Signup configuration safe for browser usage.
 * Note: uses direct process.env.NEXT_PUBLIC_* property access so Next.js inlines client values.
 */
export function getMetaPublicConfig(): MetaPublicConfig {
  const appId = readRequiredEnv("NEXT_PUBLIC_META_APP_ID", process.env.NEXT_PUBLIC_META_APP_ID);
  const embeddedSignupConfigId = readRequiredEnv(
    "NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID",
    process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID
  );
  const graphApiVersion =
    (process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION ?? "v26.0").trim() || "v26.0";

  return {
    appId,
    embeddedSignupConfigId,
    graphApiVersion,
  };
}

/**
 * Server-only Meta configuration including App Secret and AES-256-GCM token key.
 */
export function getMetaServerConfig(): MetaServerConfig {
  if (typeof window !== "undefined") {
    throw new Error("[SECURITY VIOLATION] getMetaServerConfig() cannot be called in a browser context.");
  }

  const publicConfig = getMetaPublicConfig();
  const appSecret = readRequiredEnv("META_APP_SECRET", process.env.META_APP_SECRET);
  const whatsappTokenEncryptionKey = readRequiredEnv(
    "WHATSAPP_TOKEN_ENCRYPTION_KEY",
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY
  );

  if (!/^[0-9a-fA-F]{64}$/.test(whatsappTokenEncryptionKey)) {
    throw new Error(
      "Invalid WHATSAPP_TOKEN_ENCRYPTION_KEY: expected a 64-character hex string representing 32 bytes for AES-256-GCM."
    );
  }

  return {
    ...publicConfig,
    graphApiVersion: getMetaGraphApiVersion(),
    appSecret,
    whatsappTokenEncryptionKey,
  };
}

export function getWhatsappTokenEncryptionKeyHex(): string {
  if (typeof window !== "undefined") {
    throw new Error(
      "[SECURITY VIOLATION] getWhatsappTokenEncryptionKeyHex() cannot be called in a browser context."
    );
  }

  const keyHex = readRequiredEnv(
    "WHATSAPP_TOKEN_ENCRYPTION_KEY",
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY
  );

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "Invalid WHATSAPP_TOKEN_ENCRYPTION_KEY: expected a 64-character hex string representing 32 bytes for AES-256-GCM."
    );
  }

  return keyHex;
}

export function getMetaAppSecret(): string {
  if (typeof window !== "undefined") {
    throw new Error("[SECURITY VIOLATION] getMetaAppSecret() cannot be called in a browser context.");
  }
  return readRequiredEnv("META_APP_SECRET", process.env.META_APP_SECRET);
}

export function getWhatsappWebhookVerifyToken(): string {
  if (typeof window !== "undefined") {
    throw new Error(
      "[SECURITY VIOLATION] getWhatsappWebhookVerifyToken() cannot be called in a browser context."
    );
  }
  return readRequiredEnv(
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  );
}
