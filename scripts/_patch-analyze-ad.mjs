import fs from "fs";

const p = new URL("../src/app/api/ai/analyze-ad/route.ts", import.meta.url);
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("        const systemPrompt = `Anda adalah Analis Meta Ads");
const end = s.indexOf("        const response = await client.createChatCompletion({");
if (start < 0 || end < 0) {
  console.error("markers", start, end);
  process.exit(1);
}

const insert = `        const evalResult = evaluateAdsPerformance({
          period: data.dateRange,
          durationDays: analysisPeriod.days,
          spend: data.metrics.spend,
          results: data.metrics.messagingConversations ?? data.metrics.leads ?? data.metrics.results,
          reportedCpr: data.metrics.costPerMessagingConversation ?? data.metrics.costPerLead ?? data.metrics.costPerResult,
          targetCpr: null,
          linkClicks: data.metrics.linkClicks,
          impressions: data.metrics.impressions,
          reach: data.metrics.reach ?? undefined,
          frequency: analysisAggregate?.frequency ?? null,
          campaignObjective: data.campaignObjective,
          locale: "id",
        });

        const groundTruth: CtwaGroundTruthMetrics = {
          spend: data.metrics.spend,
          link_ctr: data.metrics.linkCtr ?? null,
          cpm: data.metrics.cpm ?? null,
          link_cpc: data.metrics.linkCpc ?? null,
          messaging_conversations: data.metrics.messagingConversations ?? null,
          leads: data.metrics.leads ?? null,
          cost_per_messaging_conversation: data.metrics.costPerMessagingConversation ?? null,
          cost_per_lead: data.metrics.costPerLead ?? null,
          unique_reach: data.metrics.reach ?? null,
          impressions: data.metrics.impressions,
          link_clicks: data.metrics.linkClicks,
          all_clicks: data.metrics.allClicks,
          frequency: analysisAggregate?.frequency ?? null,
          results_legacy: data.metrics.results ?? null,
          cost_per_result_legacy: data.metrics.costPerResult ?? null,
        };

        const systemPrompt = CTWA_SYSTEM_PROMPT;
        const userPrompt = buildCtwaUserPrompt({
          adName: data.adName,
          campaignName: data.campaignName || "Kampanye Properti",
          campaignObjective: data.campaignObjective || null,
          status: data.status || "ACTIVE",
          periodLabel: analysisPeriod.label,
          durationDays: analysisPeriod.days,
          timezone: analysisPeriod.timezone,
          rowCount: analysisAggregate?.rowCount ?? 0,
          dataStatus: evalResult.dataStatus,
          dataStatusReason: evalResult.dataStatusReason,
          evaluatorAction: evalResult.action,
          targetCpr: null,
          targetCpql: null,
          property: {
            projectName: data.propertyContext?.projectName,
            location: data.propertyContext?.location,
            priceRange: data.propertyContext?.priceRange,
            propertyType: data.propertyContext?.propertyType,
          },
          metrics: groundTruth,
          untrustedChatBlock: wrapUntrustedChatBlock(sanitizedChat),
          formatMoney: formatRupiah,
        });

`;

s = s.slice(0, start) + insert + s.slice(end);
fs.writeFileSync(p, s);
console.log("ok", end - start);
