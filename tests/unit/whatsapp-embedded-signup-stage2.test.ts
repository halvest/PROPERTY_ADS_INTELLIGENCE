import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { encryptToken, decryptToken } from "@/lib/security/token-crypto";
import { getMetaPublicConfig, getMetaServerConfig } from "@/lib/meta/config";

describe("Stage 2 — WhatsApp Embedded Signup Config & AES-256-GCM Token Crypto", () => {
  const ORIGINAL_ENV = { ...process.env };
  const VALID_HEX_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_META_APP_ID: "1234567890",
      NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: "9876543210",
      META_APP_SECRET: "super_secret_meta_app_secret",
      META_GRAPH_API_VERSION: "v26.0",
      NEXT_PUBLIC_META_GRAPH_API_VERSION: "v26.0",
      WHATSAPP_TOKEN_ENCRYPTION_KEY: VALID_HEX_KEY,
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("validates public and server Meta config from environment variables", () => {
    const pub = getMetaPublicConfig();
    expect(pub.appId).toBe("1234567890");
    expect(pub.embeddedSignupConfigId).toBe("9876543210");
    expect(pub.graphApiVersion).toBe("v26.0");

    const srv = getMetaServerConfig();
    expect(srv.graphApiVersion).toBe("v26.0");
    expect(srv.appSecret).toBe("super_secret_meta_app_secret");
    expect(srv.whatsappTokenEncryptionKey).toBe(VALID_HEX_KEY);

    delete process.env.META_GRAPH_API_VERSION;
    delete process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION;
    expect(getMetaPublicConfig().graphApiVersion).toBe("v26.0");
    expect(getMetaServerConfig().graphApiVersion).toBe("v26.0");

    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = "not-a-valid-32-byte-hex-key";
    expect(() => getMetaServerConfig()).toThrow(/64-character hex string/i);
  });

  it("encrypts and decrypts access tokens with AES-256-GCM v1 structured payload", () => {
    const token = "EAABsbCS1iHgBAZExampleTokenValue12345";
    const enc1 = encryptToken(token);
    const enc2 = encryptToken(token);

    expect(enc1.keyVersion).toBe(1);
    expect(enc1.encryptedPayload.startsWith("v1:")).toBe(true);
    expect(enc1.encryptedPayload.split(":")).toHaveLength(4);
    expect(enc1.encryptedPayload).not.toContain(token);
    // Random 12-byte IV guarantees unique ciphertext per encryption call
    expect(enc1.encryptedPayload).not.toBe(enc2.encryptedPayload);

    expect(decryptToken(enc1.encryptedPayload)).toBe(token);
    expect(decryptToken(enc2.encryptedPayload)).toBe(token);
  });

  it("rejects tampered ciphertext or authTag", () => {
    const { encryptedPayload } = encryptToken("EAAB_secret_token");
    const parts = encryptedPayload.split(":");
    const tamperedTag = `${parts[2].slice(0, -2)}${parts[2].endsWith("00") ? "ff" : "00"}`;
    const tampered = [parts[0], parts[1], tamperedTag, parts[3]].join(":");

    expect(() => decryptToken(tampered)).toThrow();
    expect(() => decryptToken("v1:bad:format")).toThrow();
  });
});
