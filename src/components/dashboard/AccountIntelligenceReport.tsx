"use client";

import type { AccountIntelligenceReport } from "@/lib/ai/account-intelligence/engine";
import { formatDisplayCurrency, type DisplayLocale } from "@/lib/format/display-currency";

function money(value: number | null, currency: string, locale: DisplayLocale): string {
  if (value === null) return "—";
  return formatDisplayCurrency(value, currency, locale);
}

function targetLabel(status: string): string {
  if (status === "TARGET_NOT_CONFIGURED") return "Target belum diatur";
  if (status === "CPR_UNAVAILABLE") return "CPR tidak tersedia";
  if (status === "BETTER") return "Lebih efisien dari target";
  if (status === "ON_TARGET") return "Di kisaran target";
  if (status === "WORSE") return "Di atas target";
  return status;
}

export function AccountIntelligenceReportView({
  report,
  currency,
  locale,
}: {
  report: AccountIntelligenceReport;
  currency: string;
  locale: DisplayLocale;
}) {
  const summary = report.account_summary;
  const cards = [
    ["Campaign tersimpan", String(summary.total_campaigns)],
    ["Campaign aktif", String(summary.active_campaigns)],
    ["Campaign dijeda", String(summary.paused_campaigns)],
    ["Iklan tersimpan", String(summary.total_ads)],
    ["Total belanja", money(summary.total_spend, currency, locale)],
    ["Total hasil", summary.results_comparable ? String(summary.total_results ?? "—") : "Tidak digabung"],
    ["CPR akun", money(summary.blended_cpr, currency, locale)],
    ["CTR tautan", summary.average_ctr === null ? "—" : `${summary.average_ctr}%`],
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500">Analisis akun</p>
        <h3 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{report.analysis_metadata.account_name}</h3>
        <p className="mt-1 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          Periode analisis {report.analysis_metadata.period_start} s/d {report.analysis_metadata.period_end} · {report.analysis_metadata.timezone}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {report.analysis_metadata.account_id || "ID akun tidak dikirim"} · keyakinan {report.analysis_metadata.data_confidence}
        </p>
        <div className="mt-3 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
          <p>Inventaris: {report.analysis_metadata.analyzed_campaign_count} campaign, {report.analysis_metadata.analyzed_ad_count} iklan tersimpan.</p>
          <p>Cakupan performa: {report.analysis_metadata.campaigns_with_delivery} campaign dan {report.analysis_metadata.ads_with_delivery} iklan dengan aktivitas. Dikecualikan: {report.analysis_metadata.excluded_campaign_count} campaign, {report.analysis_metadata.excluded_ad_count} iklan.</p>
        </div>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{report.analysis_metadata.scope_note}</p>
        <p className="mt-1 text-xs text-zinc-500">
          Iklan konfigurasi aktif {report.analysis_metadata.configured_active_ads}. Status efektif aktif {report.analysis_metadata.effective_active_ads}. Status efektif dijeda {report.analysis_metadata.effective_paused_ads}. Status tidak diketahui {report.analysis_metadata.unknown_ads}.
        </p>
        {report.analysis_metadata.long_period_warning && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{report.analysis_metadata.long_period_warning}</p>
        )}
        {report.analysis_metadata.result_comparability === "ACCOUNT_RESULT_NOT_COMPARABLE" && (
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">ACCOUNT_RESULT_NOT_COMPARABLE. CPR akun tidak dihitung.</p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#141416]">
            <p className="text-[11px] text-zinc-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416]">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Diagnosis</h3>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{report.intelligence.executive_summary}</p>
        <p className="mt-2 text-xs text-zinc-500">
          Keyakinan data {report.intelligence.confidence.data} · performa {report.intelligence.confidence.performance} · keputusan {report.intelligence.confidence.decision}. {report.intelligence.confidence.explanation}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{report.intelligence.creative_fatigue.note}</p>
        <div className="mt-3 space-y-2">
          {report.intelligence.key_findings.map((finding) => (
            <details key={finding.title} className="rounded-xl border border-zinc-200 p-3 dark:border-white/10">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {finding.severity.toUpperCase()} · {finding.certainty} · {finding.title}
              </summary>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{finding.observation}</p>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{finding.diagnosis}</p>
              <p className="mt-1 text-xs text-zinc-500">{finding.business_impact}</p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                {finding.evidence.map((item) => (
                  <li key={`${finding.title}-${item.metric}`}>{item.metric}: {String(item.value)} · {item.source}</li>
                ))}
                {finding.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      {report.intelligence.strategic_recommendations.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Rencana strategis</h3>
          {report.intelligence.strategic_recommendations.map((item) => (
            <article key={`${item.object_id}-${item.action_type}`} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416]">
              <p className="text-xs font-bold text-orange-500">{item.priority} · {item.action_type}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</p>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{item.reason}</p>
              <p className="mt-1 text-xs text-zinc-500">Evaluasi: {item.evaluation_period}. {item.expected_outcome}</p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                {item.execution_steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      )}

      {report.intelligence.data_gaps.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416]">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Data yang belum tersedia</h3>
          <ul className="mt-2 space-y-1 text-xs text-zinc-500">
            {report.intelligence.data_gaps.map((gap) => (
              <li key={gap.field}>{gap.impact_on_analysis}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416]">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Anggaran</h3>
        <p className="mt-1 text-xs text-zinc-500">{report.budget_analysis.allocation_note}</p>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          Belanja {money(report.budget_analysis.total_spend, currency, locale)}. Alokasi dan sisa anggaran tidak tersedia.
          {report.budget_analysis.top_spending_campaign
            ? ` Pembelanja terbesar: ${report.budget_analysis.top_spending_campaign.name} (${report.budget_analysis.top_spending_campaign.share_pct}%).`
            : ""}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          {report.comparison.status === "COMPARISON_DATA_UNAVAILABLE"
            ? "COMPARISON_DATA_UNAVAILABLE"
            : `Periode pembanding: belanja ${money(report.comparison.previous_spend, currency, locale)}. ${report.comparison.note}`}
        </p>
      </section>

      <RankingTable
        title={report.campaign_rankings.length < 2 ? "Campaign dengan aktivitas" : "Peringkat campaign"}
        headers={["#", "Campaign", "Status", "Belanja", "Hasil", "CPR", "Target CPR", "Kinerja"]}
        rows={report.campaign_rankings.slice(0, 30).map((item) => ({
          key: item.id,
          cells: [
            report.campaign_rankings.length < 2 ? "—" : String(item.rank),
            `${item.name} · ${item.providerId}`,
            item.effectiveStatus,
            money(item.spend, currency, locale),
            item.results === null ? "—" : String(item.results),
            money(item.cpr, currency, locale),
            item.target.status === "TARGET_NOT_CONFIGURED" ? "TARGET_NOT_CONFIGURED" : money(item.target.value, currency, locale),
            `${item.category} · ${item.action}`,
          ],
        }))}
        total={report.campaign_rankings.length}
      />

      <RankingTable
        title={report.ad_rankings.length < 2 ? "Iklan dengan aktivitas" : "Peringkat iklan"}
        headers={["#", "Iklan", "Campaign", "Status efektif", "Belanja", "Hasil", "CPR", "CTR", "Kinerja"]}
        rows={report.ad_rankings.slice(0, 30).map((item) => ({
          key: item.id,
          cells: [
            report.ad_rankings.length < 2 ? "—" : String(item.rank),
            `${item.name} · ${item.providerId}`,
            item.campaignName,
            item.effectiveStatus === item.configuredStatus ? item.effectiveStatus : `${item.effectiveStatus} · konfigurasi ${item.configuredStatus}`,
            money(item.spend, currency, locale),
            item.results === null ? "—" : String(item.results),
            money(item.cpr, currency, locale),
            item.ctr === null ? "—" : `${item.ctr}%`,
            item.category,
          ],
        }))}
        total={report.ad_rankings.length}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416]">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Temuan utama</h3>
        <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          {report.key_insights.map((item) => (
            <li key={item.text}>{item.text}</li>
          ))}
        </ul>
      </section>

      {report.historical_reviews.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Tinjauan histori objek yang tidak aktif</h3>
          {report.historical_reviews.map((item) => (
            <article key={`hist-${item.objectId}-${item.action}`} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416]">
              <p className="text-xs font-bold text-zinc-500">{item.priority} · {item.action}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.objectName} · efektif {item.currentStatus}</p>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{item.recommendedAction}</p>
            </article>
          ))}
        </section>
      )}

      {report.intelligence.strategic_recommendations.length === 0 && <section className="space-y-2">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Rekomendasi</h3>
        {report.recommendations.map((item) => (
          <article key={`${item.objectId}-${item.action}`} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416]">
            <p className="text-xs font-bold text-orange-500">{item.priority} · {item.action}</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {item.objectLevel === "campaign" ? "Campaign" : "Iklan"} {item.objectName}
            </p>
            <p className="text-xs text-zinc-500">ID {item.providerId} · status {item.currentStatus} · {targetLabel(item.targetStatus)}</p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{item.recommendedAction}</p>
            <p className="mt-1 text-xs text-zinc-500">CPR {money(item.cpr, currency, locale)} · hasil {item.results ?? "—"} · belanja {money(item.spend, currency, locale)} · pantau {item.monitoring}</p>
          </article>
        ))}
      </section>}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416]">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Rencana tindakan</h3>
        <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          {report.action_plan.map((item) => (
            <li key={item.object_id + item.item}>[ ] {item.item}</li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1 text-xs text-zinc-500">
          {report.data_quality.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RankingTable({
  title,
  headers,
  rows,
  total,
}: {
  title: string;
  headers: string[];
  rows: Array<{ key: string; cells: string[] }>;
  total: number;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416]">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="mt-1 text-xs text-zinc-500">
        {rows.length} dari {total} objek ditampilkan. Peringkat dihitung untuk seluruh objek yang tersimpan.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-xs">
          <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-2 py-2 font-semibold text-zinc-500">{header}</th>
                ))}
              </tr>
            </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-zinc-100 dark:border-white/10">
                {row.cells.map((cell, index) => (
                  <td key={`${row.key}-${index}`} className="px-2 py-2 text-zinc-700 dark:text-zinc-300">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
