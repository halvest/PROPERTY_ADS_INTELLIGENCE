import crypto from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

type RowRecord = Record<string, unknown>;

interface AdminStore {
  capi_dispatch_logs: RowRecord[];
  [table: string]: RowRecord[];
}

interface SsrStore {
  workspace_members: RowRecord[];
  workspaces: RowRecord[];
  leads: RowRecord[];
  ctwa_attributions: RowRecord[];
  ctwa_ad_spend_snapshots: RowRecord[];
}

let mockAdminStore: AdminStore = { capi_dispatch_logs: [] };
let mockSsrState: { store: SsrStore; user: { id: string } | null } = {
  store: {
    workspace_members: [],
    workspaces: [],
    leads: [],
    ctwa_attributions: [],
    ctwa_ad_spend_snapshots: [],
  },
  user: null,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (!mockAdminStore[table]) mockAdminStore[table] = [];
      let op: "select" | "upsert" | "delete" | "update" = "select";
      const filters: Array<{ col: string; val: unknown }> = [];
      let payload: RowRecord | null = null;

      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters.push({ col, val });
          return builder;
        },
        contains: () => builder,
        in: () => builder,
        delete: () => {
          op = "delete";
          return builder;
        },
        update: (record: RowRecord) => {
          op = "update";
          payload = { ...record };
          return builder;
        },
        upsert: (record: RowRecord, opts?: { onConflict?: string }) => {
          op = "upsert";
          payload = { ...record };
          const conflictCol = opts?.onConflict ?? "event_id";
          const rows = mockAdminStore[table];
          const idx = rows.findIndex((r) => r[conflictCol] === payload?.[conflictCol]);
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...payload };
          } else {
            rows.push({
              id: `row-${rows.length + 1}`,
              created_at: new Date().toISOString(),
              ...payload,
            });
          }
          return Promise.resolve({ data: payload, error: null });
        },
        maybeSingle: async () => {
          if (op === "select") {
            const matched = mockAdminStore[table].find((row) =>
              filters.every((f) => row[f.col] === f.val)
            );
            return { data: matched ?? null, error: null };
          }
          return { data: payload, error: null };
        },
        then: (
          onfulfilled?: (value: { data: unknown; error: null; count: number }) => unknown
        ) => Promise.resolve({ data: [] as unknown[], error: null, count: 0 }).then(onfulfilled),
      };
      return builder;
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockSsrState.user },
        error: mockSsrState.user ? null : { message: "Not authenticated" },
      }),
    },
    from(table: keyof SsrStore) {
      const filters: Array<{ col: string; val: unknown }> = [];

      const runSelect = () => {
        return mockSsrState.store[table]
          .filter((row) => filters.every((f) => row[f.col] === f.val))
          .map((row) => {
            if (table === "workspace_members") {
              const ws =
                mockSsrState.store.workspaces.find((w) => w.id === row.workspace_id) ?? null;
              return { ...row, workspace: ws };
            }
            return { ...row };
          });
      };

      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters.push({ col, val });
          return builder;
        },
        order: () => builder,
        maybeSingle: async () => ({ data: runSelect()[0] ?? null, error: null }),
        then: <TResult1 = { data: unknown[]; error: null }>(
          onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1) | null
        ) => Promise.resolve({ data: runSelect(), error: null }).then(onfulfilled ?? undefined),
      };
      return builder;
    },
  }),
}));

import { calculateCpql } from "@/lib/meta/cpql-sync";
import { dispatchCtwaConversionEvent } from "@/lib/meta/capi-messaging";
import { POST as dataDeletionCallbackPost } from "@/app/api/meta/data-deletion-callback/route";
import { GET as getCpqlRoute } from "@/app/api/ctwa-leads/cpql/route";

function createMetaSignedRequest(payloadObj: Record<string, unknown>, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${sig}.${encodedPayload}`;
}

describe("Stage 6 — Auto-CPQL, Meta CAPI Business Messaging & Data Deletion Callback", () => {
  const ORIGINAL_ENV = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      META_APP_SECRET: "meta-app-secret-stage6",
      META_GRAPH_API_VERSION: "v26.0",
    };
    mockAdminStore = { capi_dispatch_logs: [] };
    mockSsrState = {
      store: {
        workspace_members: [],
        workspaces: [],
        leads: [],
        ctwa_attributions: [],
        ctwa_ad_spend_snapshots: [],
      },
      user: null,
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("1. computes calculateCpql() accurately and returns null on division by zero or invalid inputs", () => {
    expect(calculateCpql(1_500_000, 3)).toBe(500_000);
    expect(calculateCpql(1_000_000, 3)).toBe(333_333.33);
    expect(calculateCpql(1_500_000, 0)).toBeNull();
    expect(calculateCpql(1_500_000, -2)).toBeNull();
    expect(calculateCpql(-100, 2)).toBeNull();
  });

  it("2. dispatches Meta CAPI Business Messaging with plain-text ctwa_clid and enforces event_id idempotency", async () => {
    const rawClid = "clid_plain_text_9876543210";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ events_received: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = await dispatchCtwaConversionEvent({
      workspaceId: "ws-1",
      leadId: "lead-1",
      eventName: "QualifiedLead",
      ctwaClid: rawClid,
      datasetId: "dataset-999",
      accessToken: "capi-token-abc",
      eventTime: 1700000500,
    });

    expect(first.status).toBe("sent");
    expect(first.eventId).toBe("haspro_lead-1_QualifiedLead");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [endpointUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(endpointUrl).toBe("https://graph.facebook.com/v26.0/dataset-999/events");

    const parsedBody = JSON.parse(String(requestInit.body)) as {
      data: Array<{
        event_name: string;
        event_id: string;
        action_source: string;
        messaging_channel: string;
        user_data: { ctwa_clid: string };
      }>;
    };
    expect(parsedBody.data[0].event_name).toBe("QualifiedLead");
    expect(parsedBody.data[0].event_id).toBe("haspro_lead-1_QualifiedLead");
    expect(parsedBody.data[0].action_source).toBe("business_messaging");
    expect(parsedBody.data[0].messaging_channel).toBe("whatsapp");
    // Plain text CTWA CLID (NOT SHA-256 64-char hex)
    expect(parsedBody.data[0].user_data.ctwa_clid).toBe(rawClid);

    // Log recorded
    expect(mockAdminStore.capi_dispatch_logs).toHaveLength(1);
    expect(mockAdminStore.capi_dispatch_logs[0].status).toBe("sent");

    // Second dispatch for same lead + eventName must be skipped (idempotent)
    const second = await dispatchCtwaConversionEvent({
      workspaceId: "ws-1",
      leadId: "lead-1",
      eventName: "QualifiedLead",
      ctwaClid: rawClid,
      datasetId: "dataset-999",
      accessToken: "capi-token-abc",
    });

    expect(second.status).toBe("skipped");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("3. verifies Meta signed_request in POST /api/meta/data-deletion-callback (200 valid, 401 tampered)", async () => {
    const validSignedReq = createMetaSignedRequest(
      { algorithm: "HMAC-SHA256", issued_at: 1700000000, user_id: "meta_user_42" },
      "meta-app-secret-stage6"
    );

    const okReq = new NextRequest("http://localhost:3000/api/meta/data-deletion-callback", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ signed_request: validSignedReq }).toString(),
    });
    const okRes = await dataDeletionCallbackPost(okReq);
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as { url: string; confirmation_code: string };
    expect(okJson.confirmation_code).toMatch(/^haspro/);
    expect(okJson.url).toBe(
      `https://hdcreative.cloud/data-deletion?code=${encodeURIComponent(okJson.confirmation_code)}`
    );

    // Tampered payload segment must be rejected with 401
    const [sigPart, payloadPart] = validSignedReq.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "attacker_99" }),
      "utf8"
    ).toString("base64url");
    expect(tamperedPayload).not.toBe(payloadPart);

    const tamperedReq = new NextRequest("http://localhost:3000/api/meta/data-deletion-callback", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ signed_request: `${sigPart}.${tamperedPayload}` }).toString(),
    });
    const tamperedRes = await dataDeletionCallbackPost(tamperedReq);
    expect(tamperedRes.status).toBe(401);
  });

  it("4. GET /api/ctwa-leads/cpql returns accurate breakdown with spend and safe null fallback when spend is absent", async () => {
    const USER_ID = "user-cpql-1";
    const WS_ID = "ws-cpql-1";

    // Case A: No spend snapshots yet -> null spend, null CPL, null CPQL (never fabricated 0)
    mockSsrState = {
      user: { id: USER_ID },
      store: {
        workspaces: [{ id: WS_ID, name: "Haspro Realty", slug: "haspro" }],
        workspace_members: [{ id: "m1", workspace_id: WS_ID, user_id: USER_ID, role: "owner" }],
        leads: [
          { workspace_id: WS_ID, conversation_id: "c1", lead_temperature: "hot", pipeline_stage: "survey" },
          { workspace_id: WS_ID, conversation_id: "c2", lead_temperature: "cold", pipeline_stage: "new_inquiry" },
        ],
        ctwa_attributions: [
          {
            workspace_id: WS_ID,
            conversation_id: "c1",
            source_id: "ad_100",
            headline: "Cluster Jogja",
            campaign_id: null,
            campaign_name: null,
            adset_id: null,
            adset_name: null,
            ad_name: null,
          },
          {
            workspace_id: WS_ID,
            conversation_id: "c2",
            source_id: "ad_100",
            headline: "Cluster Jogja",
            campaign_id: null,
            campaign_name: null,
            adset_id: null,
            adset_name: null,
            ad_name: null,
          },
        ],
        ctwa_ad_spend_snapshots: [],
      },
    };

    const resNoSpend = await getCpqlRoute(new NextRequest("http://localhost:3000/api/ctwa-leads/cpql"));
    expect(resNoSpend.status).toBe(200);
    const jsonNoSpend = (await resNoSpend.json()) as {
      has_spend_data: boolean;
      total_spend: number | null;
      cpl: number | null;
      cpql: number | null;
      qualified_leads: number;
      qualification_rate: number | null;
    };
    expect(jsonNoSpend.has_spend_data).toBe(false);
    expect(jsonNoSpend.total_spend).toBeNull();
    expect(jsonNoSpend.cpl).toBeNull();
    expect(jsonNoSpend.cpql).toBeNull();
    expect(jsonNoSpend.qualified_leads).toBe(1);
    expect(jsonNoSpend.qualification_rate).toBe(50);

    // Case B: Spend snapshot present -> exact CPL & CPQL breakdown
    mockSsrState.store.ctwa_ad_spend_snapshots = [
      {
        workspace_id: WS_ID,
        ad_id: "ad_100",
        campaign_id: "camp_1",
        campaign_name: "CTWA Jogja Campaign",
        adset_id: "adset_1",
        adset_name: "Jogja 25-45",
        ad_name: "Video Rumah 2 Lantai",
        spend: 1_000_000,
        impressions: 25_000,
        clicks: 420,
        currency: "IDR",
        synced_at: "2026-11-20T05:00:00.000Z",
      },
    ];

    const resWithSpend = await getCpqlRoute(new NextRequest("http://localhost:3000/api/ctwa-leads/cpql"));
    expect(resWithSpend.status).toBe(200);
    const jsonWithSpend = (await resWithSpend.json()) as {
      has_spend_data: boolean;
      total_spend: number;
      cpl: number;
      cpql: number;
      breakdown: Array<{ ad_id: string; campaign_name: string; cpql: number }>;
    };
    expect(jsonWithSpend.has_spend_data).toBe(true);
    expect(jsonWithSpend.total_spend).toBe(1_000_000);
    expect(jsonWithSpend.cpl).toBe(500_000);
    expect(jsonWithSpend.cpql).toBe(1_000_000);
    expect(jsonWithSpend.breakdown[0].campaign_name).toBe("CTWA Jogja Campaign");
  });
});
