import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { proxy } from "@/proxy";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import * as serverSupabase from "@/lib/supabase/server";

describe("Phase 16.2 — Fix HTTP 431 & Cookie Bloat Prevention", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://udprwjbmrfknulngsjid.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Foreign and Orphaned Cookie Pruning (updateSession)", () => {
    it("detects and purges foreign Supabase project chunk cookies to prevent HTTP 431", async () => {
      // Simulate request arriving with 40KB of stale chunk cookies from another project (bipffcgnnczxomfygxve)
      const req = new NextRequest("http://localhost:3000/dashboard", {
        headers: {
          cookie: [
            "sb-bipffcgnnczxomfygxve-auth-token.0=stale_chunk_0",
            "sb-bipffcgnnczxomfygxve-auth-token.1=stale_chunk_1",
            "sb-bipffcgnnczxomfygxve-auth-token.2=stale_chunk_2",
            "sb-udprwjbmrfknulngsjid-auth-token=active_valid_session",
            "app_theme=dark",
          ].join("; "),
        },
      });

      const { supabaseResponse } = await updateSession(req);

      // Verify that request cookies were stripped of the foreign project chunks
      expect(req.cookies.get("sb-bipffcgnnczxomfygxve-auth-token.0")).toBeUndefined();
      expect(req.cookies.get("sb-bipffcgnnczxomfygxve-auth-token.1")).toBeUndefined();
      expect(req.cookies.get("sb-bipffcgnnczxomfygxve-auth-token.2")).toBeUndefined();

      // Active project and theme cookies must be preserved
      expect(req.cookies.get("sb-udprwjbmrfknulngsjid-auth-token")?.value).toBe("active_valid_session");
      expect(req.cookies.get("app_theme")?.value).toBe("dark");

      // Verify that supabaseResponse sets Max-Age=0 to instruct the browser to delete the foreign chunks
      const setCookieHeaders = supabaseResponse.headers.getSetCookie();
      const hasClearChunk0 = setCookieHeaders.some(
        (h) => h.includes("sb-bipffcgnnczxomfygxve-auth-token.0") && h.includes("Max-Age=0")
      );
      expect(hasClearChunk0).toBe(true);
    });
  });

  describe("2. Redirect Cookie Propagation in Middleware", () => {
    it("preserves Set-Cookie headers on redirects to /login when user is unauthenticated", async () => {
      const req = new NextRequest("http://localhost:3000/dashboard", {
        headers: {
          cookie: "sb-bipffcgnnczxomfygxve-auth-token.0=stale_chunk",
        },
      });

      const res = await proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?redirect=%2Fdashboard");

      // Verify that the redirect response carries the Set-Cookie deletion instruction
      const setCookies = res.headers.getSetCookie();
      const clearsStale = setCookies.some(
        (h) => h.includes("sb-bipffcgnnczxomfygxve-auth-token.0") && h.includes("Max-Age=0")
      );
      expect(clearsStale).toBe(true);
    });

    it("preserves demo_mode and allows access to protected dashboard", async () => {
      // Demo access requires server-side DATA_MODE=demo; cookie alone is not enough.
      process.env.DATA_MODE = "demo";
      const req = new NextRequest("http://localhost:3000/dashboard", {
        headers: {
          cookie: "demo_mode=true",
        },
      });

      const res = await proxy(req);
      // Demo mode should not redirect to login
      expect(res.status).toBe(200);
    });

    it("rejects demo_mode cookie when server is not in DATA_MODE=demo", async () => {
      delete process.env.DATA_MODE;
      const req = new NextRequest("http://localhost:3000/dashboard", {
        headers: { cookie: "demo_mode=true" },
      });
      const res = await proxy(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });
  });

  describe("3. Logout Complete Cookie Cleansing", () => {
    it("proactively deletes all Supabase auth and chunk cookies upon logout", async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: { signOut: mockSignOut },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const req = new NextRequest("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: [
            "demo_mode=true",
            "sb-udprwjbmrfknulngsjid-auth-token.0=chunk0",
            "sb-udprwjbmrfknulngsjid-auth-token.1=chunk1",
            "sb-udprwjbmrfknulngsjid-auth-token-code-verifier=verifier",
          ].join("; "),
        },
      });

      const res = await logoutPost(req);
      expect(res.status).toBe(200);

      const setCookies = res.headers.getSetCookie();
      // Ensure all sb- cookies are cleared with Max-Age=0
      expect(setCookies.some((h) => h.includes("sb-udprwjbmrfknulngsjid-auth-token.0") && h.includes("Max-Age=0"))).toBe(true);
      expect(setCookies.some((h) => h.includes("sb-udprwjbmrfknulngsjid-auth-token.1") && h.includes("Max-Age=0"))).toBe(true);
      expect(setCookies.some((h) => h.includes("sb-udprwjbmrfknulngsjid-auth-token-code-verifier") && h.includes("Max-Age=0"))).toBe(true);
    });
  });
});
