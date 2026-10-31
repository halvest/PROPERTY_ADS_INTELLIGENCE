import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import { finishAiAnalysis, requestIdempotencyKey, reserveAiAnalysis } from "@/lib/ai/usage-quota";

describe("server-side AI quota", () => {
  beforeEach(() => rpc.mockReset());

  it("keeps a valid request key stable for safe retries", () => {
    const key = "8e8b8f65-82db-4c41-9a2b-81b322fa8ea1";
    expect(requestIdempotencyKey(key)).toBe(key);
  });

  it("does not accept malformed idempotency keys", () => {
    const generated = requestIdempotencyKey("not-a-uuid");
    expect(generated).toMatch(/^[0-9a-f-]{36}$/i);
    expect(generated).not.toBe("not-a-uuid");
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
});
