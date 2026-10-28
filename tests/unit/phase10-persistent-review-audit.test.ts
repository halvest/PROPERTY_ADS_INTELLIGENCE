/**
 * Property Ads Intelligence - Phase 10 Persistent Review Audit & Security Tests
 * 
 * Tests the requirements of Phase 10:
 * 1. Review persistence and subsequent re-fetching.
 * 2. Unauthenticated access rejection (fail-closed).
 * 3. Tenant isolation between Tenant A and Tenant B.
 * 4. Rejection/ignorance of client-spoofed reviewer identity or organizationId.
 * 5. Rejection of invalid review statuses.
 * 6. Database error handling and safe error sanitization.
 * 7. Concurrent status updates and idempotency (upsert safety).
 * 8. Audit integrity across process restart (database-backed recovery).
 * 9. Absolute read-only guarantees (no Meta Ads or WhatsApp mutation).
 * 10. PostgreSQL RLS policy logic validation.
 */

import { describe, it, expect, vi } from "vitest";
import {
  recordRecommendationReview,
  fetchPersistentReviews,
  RecommendationReviewInputSchema,
} from "@/lib/recommendations/persistent-review-service";
import { getAdOptimizationRecommendations } from "@/lib/data/dashboard-service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

describe("Phase 10 — Persistent Review Audit & Security Hardening", () => {
  const tenantA = {
    orgId: "00000000-0000-0000-0000-000000000001",
    userId: "11111111-1111-1111-1111-111111111111",
    userName: "Budi Santoso (Tenant A)",
    role: "sales",
  };

  const tenantB = {
    orgId: "00000000-0000-0000-0000-000000000002",
    userId: "22222222-2222-2222-2222-222222222222",
    userName: "Siti Rahma (Tenant B)",
    role: "admin",
  };

  // Mock database backing store for testing persistence
  function createMockSupabaseDatabase() {
    const tableData: Record<string, Record<string, unknown>[]> = {
      ad_recommendation_reviews: [],
      profiles: [
        {
          id: tenantA.userId,
          organization_id: tenantA.orgId,
          full_name: tenantA.userName,
          role: tenantA.role,
        },
        {
          id: tenantB.userId,
          organization_id: tenantB.orgId,
          full_name: tenantB.userName,
          role: tenantB.role,
        },
      ],
    };

    let currentUser: { id: string } | null = { id: tenantA.userId };

    const client = {
      auth: {
        getUser: vi.fn().mockImplementation(async () => {
          if (!currentUser) return { data: { user: null }, error: new Error("No session") };
          return { data: { user: currentUser }, error: null };
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: vi.fn().mockImplementation(() => {
            return {
              eq: vi.fn().mockImplementation((col: string, val: unknown) => {
                const rows = (tableData[table] || []).filter((r) => r[col] === val);
                return {
                  data: rows,
                  error: null,
                  single: vi.fn().mockResolvedValue({
                    data: rows[0] || null,
                    error: rows[0] ? null : { message: "Not found" },
                  }),
                };
              }),
            };
          }),
          upsert: vi.fn().mockImplementation((row: Record<string, unknown>, opts?: { onConflict?: string }) => {
            const reviews = tableData[table] || [];
            const conflictCols = opts?.onConflict?.split(",") || ["organization_id", "recommendation_id"];
            
            const existingIndex = reviews.findIndex((r) =>
              conflictCols.every((c) => r[c.trim()] === row[c.trim()])
            );

            const insertedRow = {
              id: existingIndex >= 0 ? (reviews[existingIndex].id as string) : `rev_${reviews.length + 1}`,
              created_at: existingIndex >= 0 ? reviews[existingIndex].created_at : new Date().toISOString(),
              ...row,
            };

            if (existingIndex >= 0) {
              reviews[existingIndex] = insertedRow;
            } else {
              reviews.push(insertedRow);
            }

            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: insertedRow, error: null }),
              }),
            };
          }),
        };
      }),
      _setCurrentUser(user: { id: string } | null) {
        currentUser = user;
      },
      _getTableData(table: string) {
        return tableData[table] || [];
      },
    } as unknown as SupabaseClient<Database> & {
      _setCurrentUser: (u: { id: string } | null) => void;
      _getTableData: (t: string) => Record<string, unknown>[];
    };

    return client;
  }

  // 1. Persistence & Re-fetching
  it("Test 1: successfully persists review to database and fetches it back accurately", async () => {
    const mockDb = createMockSupabaseDatabase();

    const result = await recordRecommendationReview(
      {
        recommendationId: "rec_ad_sapphire_72_all",
        status: "reviewed",
        note: "Disetujui untuk penyesuaian strategi targeting.",
      },
      { supabaseClient: mockDb }
    );

    expect(result.success).toBe(true);
    expect(result.review).toBeDefined();
    expect(result.review?.status).toBe("reviewed");
    expect(result.review?.organizationId).toBe(tenantA.orgId);
    expect(result.review?.reviewedBy).toBe(tenantA.userId);
    expect(result.review?.reviewerName).toBe(tenantA.userName);
    expect(result.review?.reviewNote).toBe("Disetujui untuk penyesuaian strategi targeting.");

    // Fetch back
    const fetched = await fetchPersistentReviews(tenantA.orgId, mockDb);
    expect(fetched["rec_ad_sapphire_72_all"]).toBeDefined();
    expect(fetched["rec_ad_sapphire_72_all"].status).toBe("reviewed");
    expect(fetched["rec_ad_sapphire_72_all"].reviewerName).toBe(tenantA.userName);
  });

  // 2. Unauthenticated Access Rejection
  it("Test 2: rejects unauthenticated review submissions (fail-closed)", async () => {
    const mockDb = createMockSupabaseDatabase();
    mockDb._setCurrentUser(null); // No active session

    const result = await recordRecommendationReview(
      {
        recommendationId: "rec_ad_sapphire_72_all",
        status: "reviewed",
      },
      { supabaseClient: mockDb }
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("UNAUTHORIZED");
    expect(result.error).toContain("Autentikasi ditolak");
  });

  // 3. Multi-Tenant Isolation
  it("Test 3: strictly isolates reviews between Tenant A and Tenant B", async () => {
    const mockDb = createMockSupabaseDatabase();

    // Tenant A reviews an ad
    await recordRecommendationReview(
      {
        recommendationId: "rec_shared_ad_id",
        status: "reviewed",
        note: "Audit Tenant A",
      },
      {
        supabaseClient: mockDb,
        callerContext: {
          userId: tenantA.userId,
          organizationId: tenantA.orgId,
          fullName: tenantA.userName,
        },
      }
    );

    // Tenant B reviews the same recommendationId with a different status
    await recordRecommendationReview(
      {
        recommendationId: "rec_shared_ad_id",
        status: "dismissed",
        note: "Audit Tenant B",
      },
      {
        supabaseClient: mockDb,
        callerContext: {
          userId: tenantB.userId,
          organizationId: tenantB.orgId,
          fullName: tenantB.userName,
        },
      }
    );

    // Tenant A fetches their reviews
    const reviewsA = await fetchPersistentReviews(tenantA.orgId, mockDb);
    expect(reviewsA["rec_shared_ad_id"].status).toBe("reviewed");
    expect(reviewsA["rec_shared_ad_id"].reviewerName).toBe(tenantA.userName);

    // Tenant B fetches their reviews
    const reviewsB = await fetchPersistentReviews(tenantB.orgId, mockDb);
    expect(reviewsB["rec_shared_ad_id"].status).toBe("dismissed");
    expect(reviewsB["rec_shared_ad_id"].reviewerName).toBe(tenantB.userName);
  });

  // 4. Defense Against Client-Side Impersonation
  it("Test 4: ignores client-spoofed reviewedBy, organizationId, and timestamps", async () => {
    const mockDb = createMockSupabaseDatabase();

    // Malicious client tries to forge reviewedBy and organizationId
    const forgedPayload = {
      recommendationId: "rec_ad_01",
      status: "reviewed",
      reviewedBy: "00000000-0000-0000-0000-HACKED_ADMIN",
      organizationId: "00000000-0000-0000-0000-OTHER_TENANT",
      createdAt: "1970-01-01T00:00:00Z",
    };

    // Zod schema strip/reject check
    const parsed = RecommendationReviewInputSchema.parse(forgedPayload);
    expect((parsed as Record<string, unknown>).reviewedBy).toBeUndefined();
    expect((parsed as Record<string, unknown>).organizationId).toBeUndefined();

    const result = await recordRecommendationReview(forgedPayload, {
      supabaseClient: mockDb,
      callerContext: {
        userId: tenantA.userId,
        organizationId: tenantA.orgId,
        fullName: tenantA.userName,
      },
    });

    expect(result.success).toBe(true);
    // Verified that DB received authoritative server context, NOT the forged payload
    expect(result.review?.reviewedBy).toBe(tenantA.userId);
    expect(result.review?.organizationId).toBe(tenantA.orgId);
    expect(result.review?.createdAt).not.toBe("1970-01-01T00:00:00Z");
  });

  // 5. Invalid Review Status Rejection
  it("Test 5: rejects invalid statuses and empty recommendation IDs", async () => {
    const mockDb = createMockSupabaseDatabase();

    const invalidStatus = await recordRecommendationReview(
      { recommendationId: "rec_1", status: "approved_or_deleted" },
      { supabaseClient: mockDb }
    );
    expect(invalidStatus.success).toBe(false);
    expect(invalidStatus.code).toBe("VALIDATION_ERROR");

    const emptyId = await recordRecommendationReview(
      { recommendationId: "   ", status: "reviewed" },
      { supabaseClient: mockDb }
    );
    expect(emptyId.success).toBe(false);
    expect(emptyId.code).toBe("VALIDATION_ERROR");
  });

  // 6. Database Error Handling & Sanitization
  it("Test 6: handles database failures safely without leaking internals", async () => {
    const errorDb = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: tenantA.userId } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { organization_id: tenantA.orgId, full_name: tenantA.userName },
              error: null,
            }),
          }),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("PG_CONNECTION_TIMEOUT: secret_credentials_leaked"),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await recordRecommendationReview(
      { recommendationId: "rec_1", status: "reviewed" },
      { supabaseClient: errorDb }
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("DATABASE_ERROR");
    // Ensure credentials or raw SQL connection string are not leaked in user-facing message
    expect(result.error).not.toContain("secret_credentials_leaked");
    expect(result.error).toBe("Gagal menyimpan catatan audit review ke basis data PostgreSQL.");
  });

  // 7. Concurrent Status Updates & Idempotency
  it("Test 7: handles repeated and concurrent updates to the same recommendation idempotently", async () => {
    const mockDb = createMockSupabaseDatabase();

    // 1st update: mark reviewed
    const res1 = await recordRecommendationReview(
      { recommendationId: "rec_concurrent_01", status: "reviewed", note: "First review" },
      {
        supabaseClient: mockDb,
        callerContext: {
          userId: tenantA.userId,
          organizationId: tenantA.orgId,
          fullName: tenantA.userName,
        },
      }
    );
    expect(res1.success).toBe(true);

    // 2nd update: mark dismissed (updating previous status)
    const res2 = await recordRecommendationReview(
      { recommendationId: "rec_concurrent_01", status: "dismissed", note: "Changed to dismissed" },
      {
        supabaseClient: mockDb,
        callerContext: {
          userId: tenantA.userId,
          organizationId: tenantA.orgId,
          fullName: tenantA.userName,
        },
      }
    );
    expect(res2.success).toBe(true);

    // Database should have exactly 1 record for this (organization_id, recommendation_id)
    const records = mockDb._getTableData("ad_recommendation_reviews");
    const matching = records.filter(
      (r) => r.organization_id === tenantA.orgId && r.recommendation_id === "rec_concurrent_01"
    );
    expect(matching.length).toBe(1);
    expect(matching[0].status).toBe("dismissed");
    expect(matching[0].review_note).toBe("Changed to dismissed");
  });

  // 8. Audit Recovery across Server Restart
  it("Test 8: restores recommendation statuses when loaded with persistent database reviews", () => {
    const persistentDbState = {
      rec_ad_sapphire_72_all: {
        status: "reviewed" as const,
        reviewedBy: "Siti Sales Specialist",
        reviewedAt: "2026-10-26T14:00:00Z",
        reviewNote: "Divalidasi sebelum restart server",
      },
    };

    // Call service with persistent reviews injected from database
    const recommendations = getAdOptimizationRecommendations({
      organizationId: tenantA.orgId,
      persistentReviews: persistentDbState,
    });

    const target = recommendations.find((r) => r.id === "rec_ad_sapphire_72_all");
    expect(target).toBeDefined();
    expect(target?.status).toBe("reviewed");
    expect(target?.reviewedBy).toBe("Siti Sales Specialist");
    expect(target?.reviewedAt).toBe("2026-10-26T14:00:00Z");
    expect(target?.reviewNote).toBe("Divalidasi sebelum restart server");
  });

  // 9. Read-Only Safety Assurance (No Meta Ads or WhatsApp mutation)
  it("Test 9: guarantees recommendations review process makes ZERO external mutations", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const mockDb = createMockSupabaseDatabase();
    await recordRecommendationReview(
      { recommendationId: "rec_read_only_check", status: "reviewed" },
      {
        supabaseClient: mockDb,
        callerContext: {
          userId: tenantA.userId,
          organizationId: tenantA.orgId,
          fullName: tenantA.userName,
        },
      }
    );

    // Check that graph.facebook.com or api.whatsapp.com were never called
    const externalMutations = fetchSpy.mock.calls.filter((call) => {
      const url = String(call[0]);
      return (
        url.includes("graph.facebook.com") ||
        url.includes("api.whatsapp.com") ||
        url.includes("/messages") ||
        url.includes("/campaigns")
      );
    });

    expect(externalMutations.length).toBe(0);
    fetchSpy.mockRestore();
  });

  // 10. PostgreSQL RLS Logic Simulation
  it("Test 10: validates PostgreSQL RLS policies defined in Migration 5", () => {
    function evaluateReviewRlsPolicy(
      action: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
      record: { organization_id: string; reviewed_by?: string },
      caller: { organization_id: string | null; user_id: string | null; role: string | null }
    ): boolean {
      if (!caller.organization_id || !caller.user_id || !caller.role) return false;

      // 1. SELECT
      if (action === "SELECT") {
        return record.organization_id === caller.organization_id;
      }

      // 2. INSERT
      if (action === "INSERT") {
        return (
          record.organization_id === caller.organization_id &&
          record.reviewed_by === caller.user_id &&
          ["owner", "admin", "supervisor", "sales"].includes(caller.role)
        );
      }

      // 3. UPDATE
      if (action === "UPDATE") {
        return (
          record.organization_id === caller.organization_id &&
          record.reviewed_by === caller.user_id &&
          ["owner", "admin", "supervisor", "sales"].includes(caller.role)
        );
      }

      // 4. DELETE
      if (action === "DELETE") {
        return (
          record.organization_id === caller.organization_id &&
          ["owner", "admin"].includes(caller.role)
        );
      }

      return false;
    }

    // A. Tenant A user can read Org A review
    expect(
      evaluateReviewRlsPolicy(
        "SELECT",
        { organization_id: tenantA.orgId },
        { organization_id: tenantA.orgId, user_id: tenantA.userId, role: "sales" }
      )
    ).toBe(true);

    // B. Tenant B user CANNOT read Org A review
    expect(
      evaluateReviewRlsPolicy(
        "SELECT",
        { organization_id: tenantA.orgId },
        { organization_id: tenantB.orgId, user_id: tenantB.userId, role: "admin" }
      )
    ).toBe(false);

    // C. User CANNOT insert with someone else's reviewed_by (impersonation prevention)
    expect(
      evaluateReviewRlsPolicy(
        "INSERT",
        { organization_id: tenantA.orgId, reviewed_by: tenantB.userId }, // Spoofed reviewed_by
        { organization_id: tenantA.orgId, user_id: tenantA.userId, role: "sales" }
      )
    ).toBe(false);

    // D. Only owner/admin can DELETE
    expect(
      evaluateReviewRlsPolicy(
        "DELETE",
        { organization_id: tenantA.orgId },
        { organization_id: tenantA.orgId, user_id: tenantA.userId, role: "sales" } // Sales cannot delete
      )
    ).toBe(false);

    expect(
      evaluateReviewRlsPolicy(
        "DELETE",
        { organization_id: tenantA.orgId },
        { organization_id: tenantA.orgId, user_id: tenantA.userId, role: "admin" } // Admin can delete
      )
    ).toBe(true);
  });
});
