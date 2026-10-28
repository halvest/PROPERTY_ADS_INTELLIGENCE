import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/webhook/whatsapp/route";

describe("WhatsApp Webhook GET Handler (Meta Challenge Verification)", () => {
  const originalEnv = process.env;
  const testToken = "property_ads_verify_secret_123";

  beforeEach(() => {
    process.env = { ...originalEnv, WHATSAPP_VERIFY_TOKEN: testToken };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns HTTP 200 and echoes hub.challenge when credentials match", async () => {
    const url = `http://localhost:3000/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=${testToken}&hub.challenge=1158201236`;
    const request = new Request(url, { method: "GET" });

    const response = await GET(request);

    expect(response.status).toBe(200);
    const bodyText = await response.text();
    expect(bodyText).toBe("1158201236");
  });

  it("returns HTTP 403 when verify token does not match", async () => {
    const url = "http://localhost:3000/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=1158201236";
    const request = new Request(url, { method: "GET" });

    const response = await GET(request);

    expect(response.status).toBe(403);
    const bodyText = await response.text();
    expect(bodyText).toContain("Forbidden");
  });

  it("returns HTTP 403 when hub.mode is not 'subscribe'", async () => {
    const url = `http://localhost:3000/api/webhook/whatsapp?hub.mode=unsubscribe&hub.verify_token=${testToken}&hub.challenge=1158201236`;
    const request = new Request(url, { method: "GET" });

    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});
