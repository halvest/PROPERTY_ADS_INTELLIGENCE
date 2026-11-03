import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { IdempotencyKeyManager } from "@/lib/ai/idempotency-key";

const root = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

describe("IdempotencyKeyManager (one key per analysis context)", () => {
  it("reuses the same key when retrying the same context", () => {
    const manager = new IdempotencyKeyManager();
    const first = manager.keyFor("analyze-ad:ad-1");
    const retry = manager.keyFor("analyze-ad:ad-1");
    expect(retry).toBe(first);
  });

  it("uses a different key for a different analysis context", () => {
    const manager = new IdempotencyKeyManager();
    expect(manager.keyFor("analyze-ad:ad-2")).not.toBe(manager.keyFor("analyze-ad:ad-1"));
  });

  it("issues a fresh key for the next analysis after a success", () => {
    const manager = new IdempotencyKeyManager();
    const first = manager.keyFor("analyze-performance:account:30d");
    manager.complete("analyze-performance:account:30d");
    expect(manager.keyFor("analyze-performance:account:30d")).not.toBe(first);
  });
});

describe("deterministic output never consumes AI quota (source contract)", () => {
  it("analyze-ad returns deterministic output without a quota completion as success", () => {
    const route = read("src/app/api/ai/analyze-ad/route.ts");
    // Explicit non-AI markers on the deterministic payload.
    expect(route).toContain('provider: "haspro_intelligence_engine"');
    expect(route).toContain("isLiveAi: false");
    // The deterministic safety-net path releases the reservation.
    expect(route).toContain('releaseReservation("deterministic_output_no_quota")');
    // The non-configured branch returns before any reservation is made.
    const deterministicBranch = route.indexOf("if (!isConfigured)");
    const reserveCall = route.indexOf("reserveAiAnalysis(user.id, idempotencyKey)");
    expect(deterministicBranch).toBeGreaterThan(-1);
    expect(deterministicBranch).toBeLessThan(reserveCall);
  });

  it("analyze-performance marks deterministic output as rules engine and releases quota", () => {
    const route = read("src/app/api/ai/analyze-performance/route.ts");
    expect(route).toContain('engine: "rules"');
    expect(route).toContain('engine: "llm"');
    expect(route).toContain('"deterministic_output_no_quota"');
    const deterministicReturn = route.indexOf("if (!isConfigured)");
    const reserveCall = route.indexOf("reserveAiAnalysis(user.id, idempotencyKey)");
    expect(deterministicReturn).toBeGreaterThan(-1);
    expect(deterministicReturn).toBeLessThan(reserveCall);
  });

  it("all AI endpoints require a validated idempotency key before reserving", () => {
    for (const rel of [
      "src/app/api/ai/analyze-ad/route.ts",
      "src/app/api/ai/analyze-performance/route.ts",
      "src/app/api/ai/extract-evidence/route.ts",
    ]) {
      const route = read(rel);
      expect(route).toContain("validateIdempotencyKey");
      expect(route).toContain("IDEMPOTENCY_KEY_REQUIRED");
      expect(route).not.toContain("requestIdempotencyKey");
    }
  });
});

describe("quota migration contract (SQL, static)", () => {
  const sql = read("supabase/migrations/20261029103626_ai_analysis_quota.sql");

  it("enforces one consumption per (user, idempotency_key)", () => {
    expect(sql).toContain("unique (user_id, idempotency_key)");
  });

  it("serializes reservations per user with a lock row", () => {
    expect(sql).toContain("ai_analysis_quota_locks");
    expect(sql).toContain("for update");
  });

  it("uses a rolling 7-day window over successful completions", () => {
    expect(sql).toContain("completed_at > now() - interval '7 days'");
    expect(sql).toContain("status = 'succeeded'");
  });

  it("does not allow completing an expired reservation", () => {
    const completeFn = sql.slice(sql.indexOf("complete_ai_analysis_usage"));
    expect(completeFn).toContain("reserved_until > now()");
  });

  it("keeps quota tables and RPCs server-only", () => {
    expect(sql).toContain("revoke all on public.ai_analysis_usage, public.ai_analysis_quota_locks from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
