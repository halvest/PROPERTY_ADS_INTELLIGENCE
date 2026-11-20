import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

type RowRecord = Record<string, unknown>;

interface TableStore {
  workspace_members: RowRecord[];
  workspaces: RowRecord[];
  leads: RowRecord[];
  conversations: RowRecord[];
  ctwa_attributions: RowRecord[];
  whatsapp_connections: RowRecord[];
  messages: RowRecord[];
  lead_ai_analyses: RowRecord[];
  lead_pipeline_events: RowRecord[];
}

function createInMemorySsrClient(
  initial: Partial<TableStore>,
  authUser: { id: string; email?: string } | null
) {
  const store: TableStore = {
    workspace_members: initial.workspace_members ? initial.workspace_members.map((r) => ({ ...r })) : [],
    workspaces: initial.workspaces ? initial.workspaces.map((r) => ({ ...r })) : [],
    leads: initial.leads ? initial.leads.map((r) => ({ ...r })) : [],
    conversations: initial.conversations ? initial.conversations.map((r) => ({ ...r })) : [],
    ctwa_attributions: initial.ctwa_attributions ? initial.ctwa_attributions.map((r) => ({ ...r })) : [],
    whatsapp_connections: initial.whatsapp_connections
      ? initial.whatsapp_connections.map((r) => ({ ...r }))
      : [],
    messages: initial.messages ? initial.messages.map((r) => ({ ...r })) : [],
    lead_ai_analyses: initial.lead_ai_analyses ? initial.lead_ai_analyses.map((r) => ({ ...r })) : [],
    lead_pipeline_events: initial.lead_pipeline_events
      ? initial.lead_pipeline_events.map((r) => ({ ...r }))
      : [],
  };

  let idSeq = 1;
  const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

  class QueryBuilder {
    private table: keyof TableStore;
    private op: "select" | "insert" | "update" = "select";
    private filters: Array<{ col: string; val: unknown }> = [];
    private orderBy: { col: string; ascending: boolean } | null = null;
    private payload: RowRecord | null = null;

    constructor(table: keyof TableStore) {
      this.table = table;
    }

    select(cols?: string) {
      void cols;
      return this;
    }

    eq(col: string, val: unknown) {
      this.filters.push({ col, val });
      return this;
    }

    order(col: string, opts?: { ascending?: boolean }) {
      this.orderBy = { col, ascending: opts?.ascending ?? true };
      return this;
    }

    insert(record: RowRecord) {
      this.op = "insert";
      this.payload = { ...record };
      return this;
    }

    update(patch: RowRecord) {
      this.op = "update";
      this.payload = { ...patch };
      return this;
    }

    private matches(row: RowRecord): boolean {
      for (const f of this.filters) {
        if (row[f.col] !== f.val) return false;
      }
      return true;
    }

    private hydrateRow(row: RowRecord): RowRecord {
      if (this.table === "workspace_members") {
        const ws = store.workspaces.find((w) => w.id === row.workspace_id) ?? null;
        return { ...row, workspace: ws };
      }
      if (this.table === "leads") {
        const conv = store.conversations.find((c) => c.id === row.conversation_id) ?? null;
        const conn = store.whatsapp_connections.find((c) => c.id === row.connection_id) ?? null;
        return { ...row, conversation: conv, connection: conn };
      }
      return { ...row };
    }

    private execute(): { data: unknown; error: { message: string } | null } {
      const rows = store[this.table];

      if (this.op === "select") {
        let matched = rows.filter((r) => this.matches(r)).map((r) => this.hydrateRow(r));
        if (this.orderBy) {
          const { col, ascending } = this.orderBy;
          matched = [...matched].sort((a, b) => {
            const av = String(a[col] ?? "");
            const bv = String(b[col] ?? "");
            return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
          });
        }
        return { data: matched, error: null };
      }

      if (this.op === "insert" && this.payload) {
        const row: RowRecord = {
          id: this.payload.id ?? nextId(this.table),
          created_at: new Date().toISOString(),
          ...this.payload,
        };
        rows.push(row);
        return { data: row, error: null };
      }

      if (this.op === "update" && this.payload) {
        const updated: RowRecord[] = [];
        for (const row of rows) {
          if (this.matches(row)) {
            Object.assign(row, this.payload, { updated_at: new Date().toISOString() });
            updated.push(this.hydrateRow(row));
          }
        }
        return { data: updated, error: null };
      }

      return { data: null, error: null };
    }

    async maybeSingle() {
      const res = this.execute();
      if (res.error) return { data: null, error: res.error };
      const list = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
      return { data: list[0] ?? null, error: null };
    }

    async single() {
      const res = this.execute();
      if (res.error) return { data: null, error: res.error };
      const list = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
      if (list.length === 0) {
        return { data: null, error: { message: "No row found" } };
      }
      return { data: list[0], error: null };
    }

    then<TResult1 = { data: unknown; error: { message: string } | null }>(
      onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1) | null
    ) {
      return Promise.resolve(this.execute()).then(onfulfilled ?? undefined);
    }
  }

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: authUser },
        error: authUser ? null : { message: "Not authenticated" },
      }),
    },
    from(table: keyof TableStore) {
      return new QueryBuilder(table);
    },
  };

  return { store, client };
}

let mockSsrClient: ReturnType<typeof createInMemorySsrClient>["client"] | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!mockSsrClient) {
      throw new Error("mockSsrClient not initialized");
    }
    return mockSsrClient;
  },
}));

import {
  computeWorkspaceLeadMetrics,
  PatchCtwaLeadBodySchema,
} from "@/lib/ctwa-leads/types";
import { GET as listLeadsRoute } from "@/app/api/ctwa-leads/route";
import { GET as getLeadDetailRoute, PATCH as patchLeadRoute } from "@/app/api/ctwa-leads/[id]/route";

describe("Stage 5 — Lead Intelligence Dashboard API & Human Override Audit", () => {
  const LEAD_UUID = "11111111-1111-4111-8111-111111111111";
  const USER_UUID = "22222222-2222-4222-8222-222222222222";
  const WS_UUID = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    mockSsrClient = null;
  });

  it("1. validates PatchCtwaLeadBodySchema (accepts valid partial payloads and rejects empty/invalid inputs)", () => {
    expect(
      PatchCtwaLeadBodySchema.safeParse({
        pipeline_stage: "survey",
        lead_temperature: "hot",
        reason: "Confirmed site visit",
      }).success
    ).toBe(true);

    expect(
      PatchCtwaLeadBodySchema.safeParse({
        needs_human_review: false,
      }).success
    ).toBe(true);

    // Rejects empty object
    expect(PatchCtwaLeadBodySchema.safeParse({}).success).toBe(false);

    // Rejects invalid pipeline stage or temperature
    expect(
      PatchCtwaLeadBodySchema.safeParse({
        pipeline_stage: "invalid_stage",
      }).success
    ).toBe(false);
    expect(
      PatchCtwaLeadBodySchema.safeParse({
        lead_temperature: "boiling",
      }).success
    ).toBe(false);
  });

  it("2. computes workspace summary metrics (qualified_leads Warm+Hot or stage>=Qualified, avg_frt_seconds, needs_review_count)", () => {
    const metrics = computeWorkspaceLeadMetrics([
      {
        lead_temperature: "hot",
        pipeline_stage: "survey",
        needs_human_review: true,
        conversation: { first_response_time_seconds: 60 },
      },
      {
        lead_temperature: "cold",
        pipeline_stage: "qualified", // stage >= qualified counts even if temp is cold
        needs_human_review: false,
        conversation: { first_response_time_seconds: 120 },
      },
      {
        lead_temperature: "cold",
        pipeline_stage: "new_inquiry",
        needs_human_review: true,
        conversation: { first_response_time_seconds: null },
      },
      {
        lead_temperature: "junk",
        pipeline_stage: "lost",
        needs_human_review: false,
        conversation: { first_response_time_seconds: 180 },
      },
    ]);

    expect(metrics.total_leads).toBe(4);
    expect(metrics.qualified_leads).toBe(2);
    expect(metrics.needs_review_count).toBe(2);
    // Average of [60, 120, 180] = 120
    expect(metrics.avg_frt_seconds).toBe(120);

    // Returns null avg_frt_seconds when no FRT data exists (never fabricated 0)
    const emptyFrt = computeWorkspaceLeadMetrics([
      {
        lead_temperature: "cold",
        pipeline_stage: "new_inquiry",
        needs_human_review: false,
        conversation: { first_response_time_seconds: null },
      },
    ]);
    expect(emptyFrt.avg_frt_seconds).toBeNull();
  });

  it("3. PATCH /api/ctwa-leads/[id] enforces auth, sets manual_stage_lock = true, clears needs_human_review, and inserts human audit event", async () => {
    const unauthDb = createInMemorySsrClient({}, null);
    mockSsrClient = unauthDb.client;

    const unauthReq = new NextRequest(`http://localhost:3000/api/ctwa-leads/${LEAD_UUID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipeline_stage: "survey" }),
    });
    const unauthRes = await patchLeadRoute(unauthReq, {
      params: Promise.resolve({ id: LEAD_UUID }),
    });
    expect(unauthRes.status).toBe(401);

    const db = createInMemorySsrClient(
      {
        workspaces: [{ id: WS_UUID, name: "Haspro Realty", slug: "haspro-realty" }],
        workspace_members: [
          { id: "member-1", workspace_id: WS_UUID, user_id: USER_UUID, role: "owner" },
        ],
        leads: [
          {
            id: LEAD_UUID,
            workspace_id: WS_UUID,
            conversation_id: "conv-1",
            connection_id: "conn-1",
            pipeline_stage: "qualified",
            lead_temperature: "warm",
            manual_stage_lock: false,
            needs_human_review: true,
            created_at: "2026-11-20T01:00:00.000Z",
            updated_at: "2026-11-20T01:00:00.000Z",
          },
        ],
      },
      { id: USER_UUID, email: "owner@hdcreative.cloud" }
    );
    mockSsrClient = db.client;

    const patchReq = new NextRequest(`http://localhost:3000/api/ctwa-leads/${LEAD_UUID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pipeline_stage: "survey",
        lead_temperature: "hot",
        reason: "Customer confirmed visit this Saturday",
      }),
    });

    const patchRes = await patchLeadRoute(patchReq, {
      params: Promise.resolve({ id: LEAD_UUID }),
    });
    expect(patchRes.status).toBe(200);
    const patchJson = (await patchRes.json()) as {
      success: boolean;
      auditEventRecorded: boolean;
      lead: {
        pipeline_stage: string;
        lead_temperature: string;
        manual_stage_lock: boolean;
        needs_human_review: boolean;
      };
    };

    expect(patchJson.success).toBe(true);
    expect(patchJson.auditEventRecorded).toBe(true);
    expect(patchJson.lead.pipeline_stage).toBe("survey");
    expect(patchJson.lead.lead_temperature).toBe("hot");
    expect(patchJson.lead.manual_stage_lock).toBe(true);
    expect(patchJson.lead.needs_human_review).toBe(false);

    // Verify audit record persisted with actor_type = 'human' and actor_user_id = USER_UUID
    expect(db.store.lead_pipeline_events).toHaveLength(1);
    const audit = db.store.lead_pipeline_events[0];
    expect(audit.actor_type).toBe("human");
    expect(audit.actor_user_id).toBe(USER_UUID);
    expect(audit.from_stage).toBe("qualified");
    expect(audit.to_stage).toBe("survey");
    expect(audit.from_temperature).toBe("warm");
    expect(audit.to_temperature).toBe("hot");
    expect(audit.reason).toBe("Customer confirmed visit this Saturday");
  });

  it("4. GET /api/ctwa-leads & GET /api/ctwa-leads/[id] return workspace KPIs, filtered leads, and chronological read-only transcript", async () => {
    const db = createInMemorySsrClient(
      {
        workspaces: [{ id: WS_UUID, name: "Haspro Realty", slug: "haspro-realty" }],
        workspace_members: [
          { id: "member-1", workspace_id: WS_UUID, user_id: USER_UUID, role: "admin" },
        ],
        whatsapp_connections: [
          {
            id: "conn-1",
            workspace_id: WS_UUID,
            display_phone_number: "+62811000111",
            verified_name: "Haspro Sales",
            connection_status: "connected",
          },
        ],
        conversations: [
          {
            id: "conv-1",
            workspace_id: WS_UUID,
            first_response_time_seconds: 90,
            last_message_at: "2026-11-20T03:00:00.000Z",
            source_type: "ctwa",
          },
        ],
        ctwa_attributions: [
          {
            id: "attr-1",
            workspace_id: WS_UUID,
            conversation_id: "conv-1",
            source_id: "120201999888",
            source_type: "ad",
            headline: "Cluster Sapphire Jogja",
            campaign_name: null,
            adset_name: null,
            ad_name: null,
            ctwa_clid: "clid_abcdef1234567890",
            attribution_confidence: 1.0,
            created_at: "2026-11-20T02:00:00.000Z",
          },
        ],
        leads: [
          {
            id: LEAD_UUID,
            workspace_id: WS_UUID,
            conversation_id: "conv-1",
            connection_id: "conn-1",
            customer_name: "Budi Santoso",
            customer_phone_masked: "+62812****7890",
            lead_temperature: "hot",
            pipeline_stage: "survey",
            ai_score: 88,
            ai_confidence: 0.92,
            ai_summary: "Prospek ingin survei Sabtu.",
            manual_stage_lock: false,
            needs_human_review: false,
            created_at: "2026-11-20T02:00:00.000Z",
            updated_at: "2026-11-20T03:00:00.000Z",
          },
        ],
        messages: [
          {
            id: "msg-1",
            workspace_id: WS_UUID,
            conversation_id: "conv-1",
            wamid: "wamid.p.1",
            direction: "inbound_prospect",
            sender_type: "buyer",
            message_type: "text",
            body_text: "Mau survei Sabtu ini",
            body: "Mau survei Sabtu ini",
            sent_at: "2026-11-20T02:58:00.000Z",
          },
          {
            id: "msg-2",
            workspace_id: WS_UUID,
            conversation_id: "conv-1",
            wamid: "wamid.s.1",
            direction: "outbound_sales_echo",
            sender_type: "sales",
            message_type: "text",
            body_text: "Siap Pak, jam 10 pagi ya.",
            body: "Siap Pak, jam 10 pagi ya.",
            sent_at: "2026-11-20T02:59:30.000Z",
          },
        ],
      },
      { id: USER_UUID, email: "admin@hdcreative.cloud" }
    );
    mockSsrClient = db.client;

    const listReq = new NextRequest("http://localhost:3000/api/ctwa-leads?search=Sapphire");
    const listRes = await listLeadsRoute(listReq);
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      success: boolean;
      summary: { total_leads: number; qualified_leads: number; avg_frt_seconds: number | null };
      leads: Array<{ id: string; customer_name: string | null }>;
    };
    expect(listJson.success).toBe(true);
    expect(listJson.summary.total_leads).toBe(1);
    expect(listJson.summary.qualified_leads).toBe(1);
    expect(listJson.summary.avg_frt_seconds).toBe(90);
    expect(listJson.leads).toHaveLength(1);
    expect(listJson.leads[0].customer_name).toBe("Budi Santoso");

    const detailReq = new NextRequest(`http://localhost:3000/api/ctwa-leads/${LEAD_UUID}`);
    const detailRes = await getLeadDetailRoute(detailReq, {
      params: Promise.resolve({ id: LEAD_UUID }),
    });
    expect(detailRes.status).toBe(200);
    const detailJson = (await detailRes.json()) as {
      success: boolean;
      messages: Array<{ wamid: string }>;
      attribution: { campaign_name: string | null };
    };
    expect(detailJson.success).toBe(true);
    expect(detailJson.messages).toHaveLength(2);
    expect(detailJson.messages[0].wamid).toBe("wamid.p.1");
    expect(detailJson.attribution.campaign_name).toBeNull();
  });
});
