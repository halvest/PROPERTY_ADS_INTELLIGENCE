import crypto from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

type RowRecord = Record<string, unknown>;

interface TableStore {
  whatsapp_connections: RowRecord[];
  webhook_events: RowRecord[];
  conversations: RowRecord[];
  messages: RowRecord[];
  ctwa_attributions: RowRecord[];
  leads: RowRecord[];
  lead_pipeline_events: RowRecord[];
  ads: RowRecord[];
  contacts: RowRecord[];
  organization_workspaces: RowRecord[];
}

function createInMemoryAdminClient(initial?: Partial<TableStore>) {
  const store: TableStore = {
    whatsapp_connections: initial?.whatsapp_connections ? [...initial.whatsapp_connections] : [],
    webhook_events: initial?.webhook_events ? [...initial.webhook_events] : [],
    conversations: initial?.conversations ? [...initial.conversations] : [],
    messages: initial?.messages ? [...initial.messages] : [],
    ctwa_attributions: initial?.ctwa_attributions ? [...initial.ctwa_attributions] : [],
    leads: initial?.leads ? [...initial.leads] : [],
    lead_pipeline_events: initial?.lead_pipeline_events ? [...initial.lead_pipeline_events] : [],
    ads: initial?.ads ? [...initial.ads] : [],
    contacts: initial?.contacts ? [...initial.contacts] : [],
    organization_workspaces: initial?.organization_workspaces ? [...initial.organization_workspaces] : [],
  };

  let idSeq = 1;
  const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

  class QueryBuilder {
    private table: keyof TableStore;
    private op: "select" | "insert" | "upsert" | "update" = "select";
    private filters: Array<{ col: string; val: unknown }> = [];
    private predicates: Array<(row: RowRecord) => boolean> = [];
    private payload: RowRecord | null = null;
    private onConflict: string | null = null;
    private wantsRow = false;

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

    in(col: string, vals: unknown[]) {
      this.predicates.push((row) => vals.includes(row[col]));
      return this;
    }

    lt(col: string, val: unknown) {
      this.predicates.push((row) => {
        const current = row[col];
        return typeof current === "string" && typeof val === "string" && current < val;
      });
      return this;
    }

    is(col: string, val: unknown) {
      this.predicates.push((row) => (val === null ? row[col] == null : row[col] === val));
      return this;
    }

    limit(_count: number) {
      return this;
    }

    insert(record: RowRecord) {
      this.op = "insert";
      this.payload = { ...record };
      return this;
    }

    upsert(record: RowRecord, opts?: { onConflict?: string }) {
      this.op = "upsert";
      this.payload = { ...record };
      this.onConflict = opts?.onConflict ?? null;
      return this;
    }

    update(record: RowRecord) {
      this.op = "update";
      this.payload = { ...record };
      return this;
    }

    maybeSingle() {
      this.wantsRow = true;
      return this.execute();
    }

    single() {
      this.wantsRow = true;
      return this.execute();
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: { code?: string; message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
    }

    private matches(row: RowRecord): boolean {
      return this.filters.every((f) => row[f.col] === f.val) && this.predicates.every((predicate) => predicate(row));
    }

    private async execute(): Promise<{ data: unknown; error: { code?: string; message: string } | null }> {
        const rows = store[this.table] ?? [];

      if (this.op === "select") {
        const found = rows.filter((r) => this.matches(r));
        if (this.wantsRow) {
          return { data: found[0] ?? null, error: null };
        }
        return { data: found, error: null };
      }

      if (this.op === "insert" && this.payload) {
        if (
          this.table === "webhook_events" &&
          rows.some((r) => r.meta_event_id === this.payload?.meta_event_id)
        ) {
          return {
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint uq_webhook_events_meta_event_id" },
          };
        }
        if (this.table === "messages" && this.payload.wamid && rows.some((r) => r.wamid === this.payload?.wamid)) {
          return {
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint uq_messages_wamid" },
          };
        }
        if (
          this.table === "leads" &&
          rows.some((r) => r.conversation_id === this.payload?.conversation_id)
        ) {
          return {
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint leads_conversation_id_key" },
          };
        }

        const inserted: RowRecord = {
          id: (this.payload.id as string | undefined) ?? nextId(this.table),
          created_at: new Date().toISOString(),
          ...this.payload,
        };
        rows.push(inserted);
        return { data: this.wantsRow ? inserted : [inserted], error: null };
      }

      if (this.op === "upsert" && this.payload) {
        const conflictCols = (this.onConflict ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);

        const existingIndex =
          conflictCols.length > 0
            ? rows.findIndex((r) => conflictCols.every((c) => r[c] === this.payload?.[c]))
            : -1;

        if (existingIndex >= 0) {
          rows[existingIndex] = { ...rows[existingIndex], ...this.payload };
          const updated = rows[existingIndex];
          return { data: this.wantsRow ? updated : [updated], error: null };
        }

        const inserted: RowRecord = {
          id: (this.payload.id as string | undefined) ?? nextId(this.table),
          created_at: new Date().toISOString(),
          ...this.payload,
        };
        rows.push(inserted);
        return { data: this.wantsRow ? inserted : [inserted], error: null };
      }

      if (this.op === "update" && this.payload) {
        const matched: RowRecord[] = [];
        for (let i = 0; i < rows.length; i++) {
          if (this.matches(rows[i])) {
            rows[i] = { ...rows[i], ...this.payload };
            matched.push(rows[i]);
          }
        }
        return { data: this.wantsRow ? matched[0] ?? null : matched, error: null };
      }

      return { data: null, error: null };
    }
  }

  return {
    store,
    client: {
      from: (table: keyof TableStore) => new QueryBuilder(table),
    },
  };
}

let mockAdminClient: ReturnType<typeof createInMemoryAdminClient>["client"];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

import { verifyMetaWebhookSignature, maskPhoneNumber } from "@/lib/meta/webhook-security";
import { GET, POST } from "@/app/api/webhooks/whatsapp/route";
import { replayRetryingWebhookEvents, requeueDeadLetterWebhookEvent } from "@/lib/meta/webhook-ingestion";
import { qualifyCrmTemperature } from "@/lib/leads/qualified";

function signBody(rawBody: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

describe("Stage 3 — WhatsApp Webhook Receiver & Coexistence Ingestion", () => {
  const ORIGINAL_ENV = { ...process.env };
  const APP_SECRET = "test_meta_app_secret_for_webhook_hmac";
  const VERIFY_TOKEN = "test_verify_token_12345";

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      META_APP_SECRET: APP_SECRET,
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: VERIFY_TOKEN,
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("1. verifies X-Hub-Signature-256 and rejects invalid or tampered signatures", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const validSig = signBody(body, APP_SECRET);

    expect(verifyMetaWebhookSignature(body, validSig, APP_SECRET)).toBe(true);
    expect(verifyMetaWebhookSignature(body + " ", validSig, APP_SECRET)).toBe(false);
    expect(verifyMetaWebhookSignature(body, "sha256=deadbeef", APP_SECRET)).toBe(false);
    expect(verifyMetaWebhookSignature(body, null, APP_SECRET)).toBe(false);
    expect(maskPhoneNumber("6281234567890")).toBe("+62812****7890");
  });

  it("2. handles GET challenge verification (200 for valid token, 403 for invalid token)", async () => {
    const okReq = new NextRequest(
      `http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=challenge_xyz`
    );
    const okRes = await GET(okReq);
    expect(okRes.status).toBe(200);
    expect(await okRes.text()).toBe("challenge_xyz");

    const badReq = new NextRequest(
      "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge_xyz"
    );
    const badRes = await GET(badReq);
    expect(badRes.status).toBe(403);
  });

  it("3. ingests CTWA inbound message -> creates conversation, ctwa_attributions, message, masked lead, and pipeline event", async () => {
    const db = createInMemoryAdminClient({
      whatsapp_connections: [
        {
          id: "conn-1",
          workspace_id: "ws-1",
          sales_member_id: "member-sales-1",
          phone_number_id: "9988776655",
          connection_status: "connected",
          last_echo_at: null,
        },
      ],
    });
    mockAdminClient = db.client;

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "9988776655", display_phone_number: "+62811000111" },
                contacts: [{ wa_id: "6281234567890", profile: { name: "Budi Santoso" } }],
                messages: [
                  {
                    id: "wamid.inbound.001",
                    from: "6281234567890",
                    timestamp: "1700000000",
                    type: "text",
                    text: { body: "Halo saya mau info rumah 2 lantai Jogja" },
                    referral: {
                      source_id: "120201999888",
                      source_type: "ad",
                      source_url: "https://fb.me/ad123",
                      headline: "Cluster Jogja DP 0%",
                      body: "Cicilan mulai 4 jutaan",
                      ctwa_clid: "clid_abc_123",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signBody(rawBody, APP_SECRET),
      },
      body: rawBody,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });

    expect(db.store.webhook_events).toHaveLength(1);
    expect(db.store.webhook_events[0].status).toBe("processed");

    expect(db.store.conversations).toHaveLength(1);
    expect(db.store.conversations[0].source_type).toBe("ctwa");
    expect(db.store.conversations[0].needs_ai_analysis).toBe(true);

    expect(db.store.messages).toHaveLength(1);
    expect(db.store.messages[0].direction).toBe("inbound_prospect");
    expect(db.store.messages[0].wamid).toBe("wamid.inbound.001");

    expect(db.store.ctwa_attributions).toHaveLength(1);
    expect(db.store.ctwa_attributions[0].source_id).toBe("120201999888");
    expect(db.store.ctwa_attributions[0].ctwa_clid).toBe("clid_abc_123");
    // No fabricated campaign name
    expect(db.store.ctwa_attributions[0].campaign_name).toBeUndefined();

    expect(db.store.leads).toHaveLength(1);
    expect(db.store.leads[0].customer_phone_masked).toBe("+62812****7890");
    expect(db.store.leads[0].lead_temperature).toBe("unassessed");
    expect(db.store.leads[0].pipeline_stage).toBe("new_inquiry");
    expect(db.store.leads[0].assigned_sales_id).toBe("member-sales-1");

    expect(db.store.lead_pipeline_events).toHaveLength(1);
    expect(db.store.lead_pipeline_events[0].to_stage).toBe("new_inquiry");
    expect(db.store.lead_pipeline_events[0].reason).toBe("CTWA conversation detected");
  });

  it("4. ignores duplicate deliveries (same meta_event_id / wamid) and returns 401 on bad signature", async () => {
    const db = createInMemoryAdminClient({
      whatsapp_connections: [
        {
          id: "conn-1",
          workspace_id: "ws-1",
          sales_member_id: null,
          phone_number_id: "9988776655",
          connection_status: "connected",
        },
      ],
    });
    mockAdminClient = db.client;

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "9988776655" },
                messages: [
                  {
                    id: "wamid.dup.001",
                    from: "6281234567890",
                    timestamp: "1700000000",
                    type: "text",
                    text: { body: "Halo" },
                    referral: { source_id: "ad-99", source_type: "ad" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const badReq = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=" + "0".repeat(64) },
      body: rawBody,
    });
    expect((await POST(badReq)).status).toBe(401);

    const req1 = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": signBody(rawBody, APP_SECRET) },
      body: rawBody,
    });
    const req2 = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": signBody(rawBody, APP_SECRET) },
      body: rawBody,
    });

    expect((await POST(req1)).status).toBe(200);
    expect((await POST(req2)).status).toBe(200);

    expect(db.store.webhook_events).toHaveLength(1);
    expect(db.store.messages).toHaveLength(1);
    expect(db.store.leads).toHaveLength(1);
  });

  it("5. processes smb_message_echoes -> updates last_echo_at, computes FRT, and auto-advances unlocked lead to contacted", async () => {
    const firstMsgIso = new Date(1700000000 * 1000).toISOString();
    const db = createInMemoryAdminClient({
      whatsapp_connections: [
        {
          id: "conn-1",
          workspace_id: "ws-1",
          sales_member_id: "sales-1",
          phone_number_id: "9988776655",
          connection_status: "connected",
          last_echo_at: null,
        },
        {
          id: "conn-2",
          workspace_id: "ws-1",
          sales_member_id: "sales-2",
          phone_number_id: "5544332211",
          connection_status: "connected",
          last_echo_at: null,
        },
      ],
      conversations: [
        {
          id: "conv-1",
          workspace_id: "ws-1",
          connection_id: "conn-1",
          customer_wa_id: "6281234567890",
          source_type: "ctwa",
          first_message_at: firstMsgIso,
          last_message_at: firstMsgIso,
          first_response_time_seconds: null,
        },
        {
          id: "conv-locked",
          workspace_id: "ws-1",
          connection_id: "conn-2",
          customer_wa_id: "6289999999999",
          source_type: "ctwa",
          first_message_at: firstMsgIso,
          last_message_at: firstMsgIso,
          first_response_time_seconds: null,
        },
      ],
      leads: [
        {
          id: "lead-1",
          workspace_id: "ws-1",
          conversation_id: "conv-1",
          connection_id: "conn-1",
          lead_temperature: "cold",
          pipeline_stage: "new_inquiry",
          manual_stage_lock: false,
        },
        {
          id: "lead-locked",
          workspace_id: "ws-1",
          conversation_id: "conv-locked",
          connection_id: "conn-2",
          lead_temperature: "warm",
          pipeline_stage: "new_inquiry",
          manual_stage_lock: true,
        },
      ],
    });
    mockAdminClient = db.client;

    const echoPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "smb_message_echoes",
              value: {
                metadata: { phone_number_id: "9988776655" },
                message_echoes: [
                  {
                    id: "wamid.echo.001",
                    from: "62811000111",
                    to: "6281234567890",
                    timestamp: "1700000125", // 125 seconds after first_message_at
                    type: "text",
                    text: { body: "Siap Pak, berikut brosur unitnya." },
                  },
                ],
              },
            },
            {
              field: "smb_message_echoes",
              value: {
                metadata: { phone_number_id: "5544332211" },
                message_echoes: [
                  {
                    id: "wamid.echo.locked",
                    from: "62811000222",
                    to: "6289999999999",
                    timestamp: "1700000200",
                    type: "text",
                    text: { body: "Halo Bu." },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(echoPayload);
    const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": signBody(rawBody, APP_SECRET) },
      body: rawBody,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // last_echo_at updated
    expect(db.store.whatsapp_connections[0].last_echo_at).toBeTruthy();

    // FRT computed accurately (125s)
    expect(db.store.conversations[0].first_response_time_seconds).toBe(125);
    expect(db.store.conversations[0].needs_ai_analysis).toBe(true);

    // Unlocked lead transitioned new_inquiry -> contacted
    expect(db.store.leads[0].pipeline_stage).toBe("contacted");
    expect(db.store.lead_pipeline_events).toHaveLength(1);
    expect(db.store.lead_pipeline_events[0].to_stage).toBe("contacted");

    // Locked lead did NOT overwrite stage
    expect(db.store.leads[1].pipeline_stage).toBe("new_inquiry");
  });

  it("does not store a new message when the number is disconnected or revoked", async () => {
    const db = createInMemoryAdminClient({
      whatsapp_connections: [
        {
          id: "conn-1",
          workspace_id: "ws-1",
          phone_number_id: "9988776655",
          connection_status: "disconnected",
        },
      ],
    });
    mockAdminClient = db.client;
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "9988776655" },
                messages: [
                  { id: "wamid.closed.1", from: "6281234567890", timestamp: "1700000000", type: "text", text: { body: "Halo" } },
                ],
              },
            },
          ],
        },
      ],
    };
    const rawBody = JSON.stringify(payload);
    const res = await POST(new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": signBody(rawBody, APP_SECRET) },
      body: rawBody,
    }));
    expect(res.status).toBe(200);
    expect(db.store.messages).toHaveLength(0);
    expect(db.store.conversations).toHaveLength(0);
    expect(db.store.webhook_events[0].status).toBe("processed");
    expect(db.store.webhook_events[0].error_message).toBe("connection_not_authorized");
  });

  it("reprocesses a failed event when Meta delivers it again", async () => {
    const db = createInMemoryAdminClient({
      whatsapp_connections: [
        {
          id: "conn-1",
          workspace_id: "ws-1",
          phone_number_id: "9988776655",
          connection_status: "connected",
        },
      ],
      webhook_events: [
        {
          id: "event-failed",
          meta_event_id: "waba-1:messages:wamid.retry.1",
          status: "failed",
          error_message: "attempts=1 insert failed",
          received_at: new Date(Date.now() - 60_000).toISOString(),
          phone_number_id: "9988776655",
          workspace_id: "ws-1",
          event_type: "messages",
          payload: {},
        },
      ],
    });
    mockAdminClient = db.client;
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "9988776655" },
                messages: [
                  { id: "wamid.retry.1", from: "6281234567890", timestamp: "1700000000", type: "text", text: { body: "Halo" } },
                ],
              },
            },
          ],
        },
      ],
    };
    const rawBody = JSON.stringify(payload);
    const first = await POST(new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": signBody(rawBody, APP_SECRET) },
      body: rawBody,
    }));
    expect(first.status).toBe(200);
    expect(db.store.messages).toHaveLength(1);
  });

  it("links a CTWA message only when one provider ad id matches, and leaves temperature unassessed", async () => {
    const db = createInMemoryAdminClient({
      whatsapp_connections: [
        {
          id: "conn-1",
          workspace_id: "ws-1",
          organization_id: "org-1",
          sales_member_id: "member-sales-1",
          phone_number_id: "9988776655",
          connection_status: "connected",
        },
      ],
      ads: [
        {
          id: "ad-1",
          organization_id: "org-1",
          campaign_id: "camp-1",
          provider_ad_id: "120201999888",
        },
      ],
    });
    mockAdminClient = db.client;
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "9988776655" },
                messages: [
                  {
                    id: "wamid.linked.1",
                    from: "6281234567890",
                    timestamp: "1700000000",
                    type: "text",
                    text: { body: "Halo" },
                    referral: { source_id: "120201999888", source_type: "ad" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const rawBody = JSON.stringify(payload);
    const res = await POST(new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": signBody(rawBody, APP_SECRET) },
      body: rawBody,
    }));
    expect(res.status).toBe(200);
    expect(db.store.conversations[0].ad_id).toBe("ad-1");
    expect(db.store.conversations[0].campaign_id).toBe("camp-1");
    expect(db.store.conversations[0].attribution_status).toBe("verified");
    expect(db.store.conversations[0].channel).toBe("whatsapp");
    expect(db.store.leads[0].lead_temperature).toBe("unassessed");
    expect(qualifyCrmTemperature("unassessed")).toBe("unassessed");
    expect(qualifyCrmTemperature("Warm")).toBe("qualified");
    expect(qualifyCrmTemperature("cold")).toBe("not_qualified");
  });

  it("does not process a second delivery while the processing lease is fresh", async () => {
    const db = createInMemoryAdminClient({
      whatsapp_connections: [
        {
          id: "conn-1",
          workspace_id: "ws-1",
          phone_number_id: "9988776655",
          connection_status: "connected",
        },
      ],
      webhook_events: [
        {
          id: "event-live",
          meta_event_id: "waba-1:messages:wamid.live.1",
          status: "processing",
          claimed_at: new Date().toISOString(),
          received_at: new Date().toISOString(),
          phone_number_id: "9988776655",
          workspace_id: "ws-1",
          event_type: "messages",
          payload: {},
        },
      ],
    });
    mockAdminClient = db.client;
    const payload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "waba-1",
        changes: [{
          field: "messages",
          value: {
            metadata: { phone_number_id: "9988776655" },
            messages: [{ id: "wamid.live.1", from: "6281234567890", timestamp: "1700000000", type: "text", text: { body: "Halo" } }],
          },
        }],
      }],
    };
    const rawBody = JSON.stringify(payload);
    const res = await POST(new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": signBody(rawBody, APP_SECRET) },
      body: rawBody,
    }));
    expect(res.status).toBe(200);
    expect(db.store.messages).toHaveLength(0);
    expect(db.store.webhook_events[0].status).toBe("processing");
  });

  it("recovers a stale processing lock and replays a requeued dead letter once", async () => {
    const change = {
      field: "messages",
      value: {
        metadata: { phone_number_id: "9988776655" },
        messages: [{ id: "wamid.stale.1", from: "6281234567890", timestamp: "1700000000", type: "text", text: { body: "Halo dari iklan" } }],
      },
    };
    const db = createInMemoryAdminClient({
      whatsapp_connections: [
        {
          id: "conn-1",
          workspace_id: "ws-1",
          phone_number_id: "9988776655",
          connection_status: "connected",
        },
      ],
      webhook_events: [
        {
          id: "event-stale",
          meta_event_id: "waba-1:messages:wamid.stale.1",
          status: "processing",
          claimed_at: new Date(Date.now() - 10 * 60_000).toISOString(),
          received_at: new Date(Date.now() - 10 * 60_000).toISOString(),
          phone_number_id: "9988776655",
          workspace_id: "ws-1",
          event_type: "messages",
          payload: change,
        },
      ],
    });
    mockAdminClient = db.client;
    const payload = {
      object: "whatsapp_business_account",
      entry: [{ id: "waba-1", changes: [change] }],
    };
    const rawBody = JSON.stringify(payload);
    const recovered = await POST(new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": signBody(rawBody, APP_SECRET) },
      body: rawBody,
    }));
    expect(recovered.status).toBe(200);
    expect(db.store.messages).toHaveLength(1);
    expect(db.store.webhook_events[0].status).toBe("processed");

    db.store.messages.length = 0;
    db.store.webhook_events[0].status = "dead_letter";
    db.store.webhook_events[0].error_message = "attempts=5 permanent";
    const blocked = await POST(new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": signBody(rawBody, APP_SECRET) },
      body: rawBody,
    }));
    expect(blocked.status).toBe(200);
    expect(db.store.messages).toHaveLength(0);

    expect(await requeueDeadLetterWebhookEvent("event-stale")).toBe(true);
    expect(db.store.webhook_events[0].status).toBe("retrying");
    expect(await replayRetryingWebhookEvents()).toBe(1);
    expect(db.store.messages).toHaveLength(1);
    expect(db.store.webhook_events).toHaveLength(1);
  });
});
