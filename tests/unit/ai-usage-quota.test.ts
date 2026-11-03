import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import { finishAiAnalysis, readAiAnalysisUsage, reserveAiAnalysis, validateIdempotencyKey } from "@/lib/ai/usage-quota";

describe("server-side AI quota", () => {
  beforeEach(() => rpc.mockReset());

  it("keeps a valid request key stable for safe retries", () => {
    const key = "8e8b8f65-82db-4c41-9a2b-81b322fa8ea1";
    expect(validateIdempotencyKey(key)).toBe(key);
  });

  it("rejects malformed or missing keys instead of silently replacing them", () => {
    expect(validateIdempotencyKey("not-a-uuid")).toBeNull();
    expect(validateIdempotencyKey("")).toBeNull();
    expect(validateIdempotencyKey(null)).toBeNull();
  });

  it("allows only a successful atomic reservation result", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: true, reservation_status: "reserved", reservation_id: "reservation-1" }], error: null });
    await expect(reserveAiAnalysis("authenticated-user", "8e8b8f65-82db-4c41-9a2b-81b322fa8ea1"))
      .resolves.toEqual({ ok: true, reservationId: "reservation-1" });
    expect(rpc).toHaveBeenCalledWith("reserve_ai_analysis_usage", {
      p_user_id: "authenticated-user",
      p_idempotency_key: "8e8b8f65-82db-4c41-9a2b-81b322fa8ea1",
    });
  });

  it("rejects full and duplicate reservations without consuming another slot", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, reservation_status: "limit_reached", reservation_id: null, next_available_at: "2026-11-01T00:00:00Z" }], error: null });
    await expect(reserveAiAnalysis("user-1", "8e8b8f65-82db-4c41-9a2b-81b322fa8ea1"))
      .resolves.toMatchObject({ ok: false, unavailable: false, status: "limit_reached", resetAt: "2026-11-01T00:00:00Z" });
  });

  it("marks reservations only through the server completion RPC", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(finishAiAnalysis("user-1", "reservation-1", true)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("complete_ai_analysis_usage", {
      p_user_id: "user-1",
      p_reservation_id: "reservation-1",
      p_succeeded: true,
      p_failure_code: null,
    });
  });

  it("treats an expired or already-completed reservation as not completable", async () => {
    // The SQL RPC returns false when the reservation is no longer reserved
    // or its reserved_until has passed; the wrapper must surface that.
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(finishAiAnalysis("user-1", "expired-reservation", true)).resolves.toBe(false);
  });

  it("passes duplicate-reservation statuses through without consuming a slot", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, reservation_status: "already_completed", reservation_id: "reservation-1", next_available_at: null }], error: null });
    await expect(reserveAiAnalysis("user-1", "8e8b8f65-82db-4c41-9a2b-81b322fa8ea1"))
      .resolves.toMatchObject({ ok: false, unavailable: false, status: "already_completed" });
  });

  it("fails closed when the quota RPC is unavailable", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(reserveAiAnalysis("user-1", "8e8b8f65-82db-4c41-9a2b-81b322fa8ea1"))
      .resolves.toEqual({ ok: false, unavailable: true });
    await expect(readAiAnalysisUsage("user-1")).resolves.toBeNull();
  });

  it("returns server-calculated usage values for the usage endpoint", async () => {
    rpc.mockResolvedValue({ data: [{ used_count: 1, reserved_count: 1, remaining_count: 1, next_available_at: "2026-11-05T00:00:00Z" }], error: null });
    await expect(readAiAnalysisUsage("user-2")).resolves.toEqual({
      used_count: 1, reserved_count: 1, remaining_count: 1, next_available_at: "2026-11-05T00:00:00Z",
    });
    expect(rpc).toHaveBeenCalledWith("get_ai_analysis_usage", { p_user_id: "user-2" });
  });
});
