import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

type RowRecord = Record<string, unknown>;

interface TableStore {
  conversations: RowRecord[];
  messages: RowRecord[];
  ctwa_attributions: RowRecord[];
  leads: RowRecord[];
  lead_ai_analyses: RowRecord[];
  lead_pipeline_events: RowRecord[];
}

function createInMemoryAdminClient(initial?: Partial<TableStore>) {
  const store: TableStore = {
    conversations: initial?.conversations ? initial.conversations.map((r) => ({ ...r })) : [],
    messages: initial?.messages ? initial.messages.map((r) => ({ ...r })) : [],
    ctwa_attributions: initial?.ctwa_attributions
      ? initial.ctwa_attributions.map((r) => ({ ...r }))
      : [],
    leads: initial?.leads ? initial.leads.map((r) => ({ ...r })) : [],
    lead_ai_analyses: initial?.lead_ai_analyses
      ? initial.lead_ai_analyses.map((r) => ({ ...r }))
      : [],
    lead_pipeline_events: initial?.lead_pipeline_events
      ? initial.lead_pipeline_events.map((r) => ({ ...r }))
      : [],
  };

  let idSeq = 1;
  const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

  class QueryBuilder {
    private table: keyof TableStore;
    private op: "select" | "insert" | "update" = "select";
    private eqFilters: Array<{ col: string; val: unknown }> = [];
    private lteFilters: Array<{ col: string; val: string }> = [];
    private orderBy: { col: string; ascending: boolean } | null = null;
    private limitCount: number | null = null;
    private payload: RowRecord | null = null;

    constructor(table: keyof TableStore) {
      this.table = table;
    }

    select(cols?: string) {
      void cols;
      return this;
    }

    eq(col: string, val: unknown) {
      this.eqFilters.push({ col, val });
      return this;
    }

    lte(col: string, val: string) {
      this.lteFilters.push({ col, val });
      return this;
    }

    order(col: string, opts?: { ascending?: boolean }) {
      this.orderBy = { col, ascending: opts?.ascending ?? true };
      return this;
    }

    limit(count: number) {
      this.limitCount = count;
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
      for (const f of this.eqFilters) {
        if (row[f.col] !== f.val) return false;
      }
      for (const f of this.lteFilters) {
        const raw = row[f.col];
        if (typeof raw !== "string") return false;
        if (Date.parse(raw) > Date.parse(f.val)) return false;
      }
      return true;
    }

    private execute(): { data: unknown; error: { message: string } | null } {
      const rows = store[this.table];

      if (this.op === "select") {
        let matched = rows.filter((r) => this.matches(r));
        if (this.orderBy) {
          const { col, ascending } = this.orderBy;
          matched = [...matched].sort((a, b) => {
            const av = String(a[col] ?? "");
            const bv = String(b[col] ?? "");
            return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
          });
        }
        if (this.limitCount !== null) {
          matched = matched.slice(0, this.limitCount);
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
            Object.assign(row, this.payload);
            updated.push(row);
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
    from(table: keyof TableStore) {
      return new QueryBuilder(table);
    },
  };

  return { store, client };
}

let mockAdminClient: ReturnType<typeof createInMemoryAdminClient>["client"] | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (!mockAdminClient) {
      throw new Error("mockAdminClient not initialized");
    }
    return mockAdminClient;
  },
}));

import { evaluateLeadTransition } from "@/lib/ai/lead-intelligence/pipeline-rules";
import { buildConversationTranscript, LEAD_ANALYZER_PROMPT_VERSION } from "@/lib/ai/lead-intelligence/prompt";
import { LeadAnalysisOutputSchema, type LeadAnalysisOutput } from "@/lib/ai/lead-intelligence/schema";
import { processPendingLeadAnalyses } from "@/lib/ai/lead-intelligence/worker";
import { POST } from "@/app/api/workers/analyze-leads/route";

function makeBaseAiOutput(overrides?: Partial<LeadAnalysisOutput>): LeadAnalysisOutput {
  return LeadAnalysisOutputSchema.parse({
    summary: "Prospek menanyakan rumah 2 lantai di Jogja dengan budget sekitar 1.5M.",
    lead_temperature: "warm",
    pipeline_stage_suggestion: "qualified",
    score: 72,
    intent_signals: ["Mencari hunian keluarga", "Menyebutkan budget 1.5M"],
    property_preferences: {
      project: "Cluster Sapphire",
      location: "Sleman, Jogja",
      budget: "Rp 1,5 Miliar",
      unit_type: "2 Lantai",
    },
    objections: [],
    unanswered_questions: ["Apakah ada promo free biaya KPR?"],
    evidence: [
      { message_id: "wamid.prospect.1", reason: "Prospek menyebut budget 1.5M dan lokasi Jogja" },
    ],
    confidence: 0.88,
    needs_human_review: false,
    ...overrides,
  });
}

describe("Stage 4 — AI Lead Intelligence Engine & Deterministic Pipeline", () => {
  const ORIGINAL_ENV = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      CRON_SECRET: "test-cron-secret-stage4",
      MODEL_API_KEY: "test-meta-model-key",
      META_MODEL_BASE_URL: "https://api.meta.ai/v1",
      META_MUSE_SPARK_MODEL: "muse-spark-1.3",
    };
    delete process.env.LEAD_AI_API_KEY;
    delete process.env.LEAD_AI_API_BASE_URL;
    delete process.env.LEAD_AI_MODEL;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("1. strips hallucinated evidence wamid values that do not exist in conversation messages", () => {
    const aiOutput = makeBaseAiOutput({
      evidence: [
        { message_id: "wamid.real.001", reason: "Pesan asli prospek menyebut budget" },
        { message_id: "wamid.hallucinated.999", reason: "Wamid karangan AI" },
      ],
    });

    const result = evaluateLeadTransition({
      currentLead: {
        pipeline_stage: "contacted",
        lead_temperature: "cold",
        manual_stage_lock: false,
      },
      aiOutput,
      messages: [
        { wamid: "wamid.real.001", direction: "inbound_prospect" },
        { wamid: "wamid.sales.001", direction: "outbound_sales_echo" },
      ],
    });

    expect(result.validEvidence).toEqual([
      { message_id: "wamid.real.001", reason: "Pesan asli prospek menyebut budget" },
    ]);
    expect(result.droppedEvidenceCount).toBe(1);
    expect(result.nextStage).toBe("qualified");
  });

  it("2. enforces Anti-Downgrade rule: refuses downgrading stage from survey back to contacted", () => {
    const aiOutput = makeBaseAiOutput({
      pipeline_stage_suggestion: "contacted",
      evidence: [{ message_id: "wamid.p1", reason: "Balasan lanjutan prospek" }],
    });

    const result = evaluateLeadTransition({
      currentLead: {
        pipeline_stage: "survey",
        lead_temperature: "hot",
        manual_stage_lock: false,
      },
      aiOutput,
      messages: [{ wamid: "wamid.p1", direction: "inbound_prospect" }],
    });

    expect(result.nextStage).toBe("survey");
    expect(result.stageChanged).toBe(false);
    expect(result.transitionReason).toContain("anti-downgrade");
  });

  it("3. rejects transition to qualified when evidence only cites outbound_sales_echo messages", () => {
    const aiOutput = makeBaseAiOutput({
      pipeline_stage_suggestion: "qualified",
      evidence: [
        { message_id: "wamid.sales.echo.1", reason: "Sales menawarkan simulasi KPR" },
      ],
    });

    const result = evaluateLeadTransition({
      currentLead: {
        pipeline_stage: "contacted",
        lead_temperature: "cold",
        manual_stage_lock: false,
      },
      aiOutput,
      messages: [
        { wamid: "wamid.prospect.hi", direction: "inbound_prospect" },
        { wamid: "wamid.sales.echo.1", direction: "outbound_sales_echo" },
      ],
    });

    expect(result.validEvidence).toHaveLength(1);
    expect(result.nextStage).toBe("contacted");
    expect(result.stageChanged).toBe(false);
    expect(result.transitionReason).toContain("prospect-evidence");
  });

  it("4. triggers Human-Gate for won/lost with confidence < 0.90 and sets needs_human_review = true", () => {
    const aiOutput = makeBaseAiOutput({
      pipeline_stage_suggestion: "won",
      lead_temperature: "hot",
      confidence: 0.78,
      needs_human_review: false,
      evidence: [{ message_id: "wamid.p.booking", reason: "Prospek tanya rekening booking fee" }],
    });

    const result = evaluateLeadTransition({
      currentLead: {
        pipeline_stage: "closing",
        lead_temperature: "hot",
        manual_stage_lock: false,
      },
      aiOutput,
      messages: [{ wamid: "wamid.p.booking", direction: "inbound_prospect" }],
    });

    expect(result.nextStage).toBe("closing");
    expect(result.stageChanged).toBe(false);
    expect(result.needsHumanReview).toBe(true);
    expect(result.transitionReason).toContain("human-gate");
  });

  it("5. preserves pipeline_stage when manual_stage_lock = true while still storing lead_ai_analyses snapshot", async () => {
    const oldLastMsgIso = new Date(Date.now() - 300_000).toISOString();

    const db = createInMemoryAdminClient({
      conversations: [
        {
          id: "conv-locked-1",
          workspace_id: "ws-1",
          source_type: "ctwa",
          needs_ai_analysis: true,
          last_message_at: oldLastMsgIso,
        },
      ],
      messages: [
        {
          conversation_id: "conv-locked-1",
          wamid: "wamid.locked.p1",
          direction: "inbound_prospect",
          body_text: "Saya siap survei lokasi minggu ini dan budget 2M cash.",
          message_type: "text",
          sent_at: oldLastMsgIso,
        },
      ],
      ctwa_attributions: [
        {
          conversation_id: "conv-locked-1",
          headline: "Cluster Jogja Eksklusif",
          body: "Tipe 2 Lantai",
        },
      ],
      leads: [
        {
          id: "lead-locked-1",
          workspace_id: "ws-1",
          conversation_id: "conv-locked-1",
          pipeline_stage: "contacted",
          lead_temperature: "cold",
          manual_stage_lock: true,
          needs_human_review: false,
        },
      ],
    });
    mockAdminClient = db.client;

    const llmSuggestion = makeBaseAiOutput({
      lead_temperature: "hot",
      pipeline_stage_suggestion: "survey",
      score: 86,
      confidence: 0.93,
      evidence: [
        { message_id: "wamid.locked.p1", reason: "Prospek minta survei dan punya budget 2M cash" },
      ],
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "muse-spark-1.3",
          choices: [{ message: { content: JSON.stringify(llmSuggestion) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const summary = await processPendingLeadAnalyses({ debounceSeconds: 120, batchSize: 10 });

    expect(summary.analyzed).toBe(1);
    expect(summary.stageTransitions).toBe(0);
    expect(summary.temperatureTransitions).toBe(1);

    // Stage preserved because manual_stage_lock = true
    expect(db.store.leads[0].pipeline_stage).toBe("contacted");
    expect(db.store.leads[0].lead_temperature).toBe("hot");
    expect(db.store.leads[0].ai_score).toBe(86);

    // AI snapshot still stored with valid prompt version & evidence
    expect(db.store.lead_ai_analyses).toHaveLength(1);
    expect(db.store.lead_ai_analyses[0].prompt_version).toBe(LEAD_ANALYZER_PROMPT_VERSION);
    expect(db.store.lead_ai_analyses[0].pipeline_stage_suggestion).toBe("survey");

    // Audit event recorded temperature transition with actor_type = 'ai'
    expect(db.store.lead_pipeline_events).toHaveLength(1);
    expect(db.store.lead_pipeline_events[0].actor_type).toBe("ai");
    expect(db.store.lead_pipeline_events[0].from_stage).toBe("contacted");
    expect(db.store.lead_pipeline_events[0].to_stage).toBe("contacted");
    expect(db.store.lead_pipeline_events[0].to_temperature).toBe("hot");

    // Conversation flag cleared
    expect(db.store.conversations[0].needs_ai_analysis).toBe(false);
    expect(db.store.conversations[0].last_ai_analyzed_at).toBeTruthy();
  });

  it("6. rejects unauthorized POST /api/workers/analyze-leads (401) and only analyzes CTWA conversations past debounce window", async () => {
    const nowMs = Date.now();
    const expiredDebounceIso = new Date(nowMs - 180_000).toISOString(); // 3 mins ago > 120s
    const activeDebounceIso = new Date(nowMs - 20_000).toISOString(); // 20s ago < 120s

    const db = createInMemoryAdminClient({
      conversations: [
        {
          id: "conv-ready",
          workspace_id: "ws-1",
          source_type: "ctwa",
          needs_ai_analysis: true,
          last_message_at: expiredDebounceIso,
        },
        {
          id: "conv-debouncing",
          workspace_id: "ws-1",
          source_type: "ctwa",
          needs_ai_analysis: true,
          last_message_at: activeDebounceIso,
        },
        {
          id: "conv-organic",
          workspace_id: "ws-1",
          source_type: "organic",
          needs_ai_analysis: true,
          last_message_at: expiredDebounceIso,
        },
      ],
      messages: [
        {
          conversation_id: "conv-ready",
          wamid: "wamid.ready.1",
          direction: "inbound_prospect",
          body_text: "Bisa KPR cicilan 5 jutaan untuk tipe 72 di BSD?",
          message_type: "text",
          sent_at: expiredDebounceIso,
        },
        {
          conversation_id: "conv-debouncing",
          wamid: "wamid.deb.1",
          direction: "inbound_prospect",
          body_text: "Halo",
          message_type: "text",
          sent_at: activeDebounceIso,
        },
      ],
      leads: [
        {
          id: "lead-ready",
          workspace_id: "ws-1",
          conversation_id: "conv-ready",
          pipeline_stage: "contacted",
          lead_temperature: "cold",
          manual_stage_lock: false,
          needs_human_review: false,
        },
        {
          id: "lead-debouncing",
          workspace_id: "ws-1",
          conversation_id: "conv-debouncing",
          pipeline_stage: "new_inquiry",
          lead_temperature: "cold",
          manual_stage_lock: false,
          needs_human_review: false,
        },
      ],
    });
    mockAdminClient = db.client;

    const llmOutput = makeBaseAiOutput({
      lead_temperature: "warm",
      pipeline_stage_suggestion: "qualified",
      score: 74,
      confidence: 0.85,
      evidence: [
        { message_id: "wamid.ready.1", reason: "Prospek menyebut skema KPR 5jt & tipe 72 BSD" },
      ],
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "muse-spark-1.3",
          choices: [{ message: { content: JSON.stringify(llmOutput) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // Without secret -> 401
    const unauthReq = new NextRequest("http://localhost:3000/api/workers/analyze-leads", {
      method: "POST",
    });
    const unauthRes = await POST(unauthReq);
    expect(unauthRes.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();

    // With wrong secret -> 401
    const wrongReq = new NextRequest("http://localhost:3000/api/workers/analyze-leads", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect((await POST(wrongReq)).status).toBe(401);

    // With valid secret -> 200 and processes only conv-ready
    const okReq = new NextRequest(
      "http://localhost:3000/api/workers/analyze-leads?debounceSeconds=120&batchSize=10",
      {
        method: "POST",
        headers: { authorization: "Bearer test-cron-secret-stage4" },
      }
    );
    const okRes = await POST(okReq);
    expect(okRes.status).toBe(200);
    const json = (await okRes.json()) as {
      success: boolean;
      scanned: number;
      analyzed: number;
      stageTransitions: number;
    };
    expect(json.success).toBe(true);
    expect(json.scanned).toBe(1);
    expect(json.analyzed).toBe(1);
    expect(json.stageTransitions).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchUrl).toBe("https://api.meta.ai/v1/chat/completions");
    const parsedReqBody = JSON.parse(String(fetchInit.body)) as { model: string };
    expect(parsedReqBody.model).toBe("muse-spark-1.3");

    // conv-ready promoted to qualified; conv-debouncing untouched
    expect(db.store.leads[0].pipeline_stage).toBe("qualified");
    expect(db.store.conversations[0].needs_ai_analysis).toBe(false);
    expect(db.store.leads[1].pipeline_stage).toBe("new_inquiry");
    expect(db.store.conversations[1].needs_ai_analysis).toBe(true);

    // Transcript helper format check
    const transcript = buildConversationTranscript([
      {
        wamid: "wamid.ready.1",
        direction: "inbound_prospect",
        body_text: "Bisa KPR?",
        sent_at: "2026-11-20T03:15:00.000Z",
      },
      {
        wamid: "wamid.sales.1",
        direction: "outbound_sales_echo",
        body_text: "Bisa Pak, DP mulai 5%",
        sent_at: "2026-11-20T03:16:00.000Z",
      },
    ]);
    expect(transcript).toContain("[wamid.ready.1 | 10:15 | PROSPECT]: Bisa KPR?");
    expect(transcript).toContain("[wamid.sales.1 | 10:16 | SALES]: Bisa Pak, DP mulai 5%");
  });
});
