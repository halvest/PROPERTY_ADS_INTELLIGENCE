import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

describe("Supabase Client Architecture & Security Guardrails", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("createBrowserClient initializes without crashing in demo/fallback mode", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const client = createBrowserClient();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe("function");
    expect(typeof client.auth.getSession).toBe("function");
  });

  it("createAdminClient throws security violation if called in browser window context", () => {
    // Simulate browser window
    const target = globalThis as Record<string, unknown>;
    target.window = {};

    try {
      expect(() => createAdminClient()).toThrowError(/SECURITY VIOLATION/);
    } finally {
      delete target.window;
    }
  });

  it("createAdminClient throws error if service role key is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createAdminClient()).toThrowError(/Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("createAdminClient instantiates successfully on server when credentials are provided", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    const admin = createAdminClient();
    expect(admin).toBeDefined();
    expect(typeof admin.from).toBe("function");
  });
});
