/**
 * Property Ads Intelligence - Optional Meta Model API Live Smoke Test
 *
 * Usage:
 *   npx tsx scripts/smoke-test-meta-model.ts
 *
 * Rules:
 * - NEVER run during automated build, lint, or CI.
 * - Safely skips if MODEL_API_KEY is not provided.
 * - Masks all credentials and avoids printing sensitive data.
 */

import { createRequire } from "node:module";

// Mock server-only for standalone script execution outside Next.js compiler
const require = createRequire(import.meta.url);
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    paths: [],
    children: [],
    isPreloading: false,
    require,
  } as unknown as NodeModule;
} catch {}

async function runSmokeTest() {
  const { maskApiKey, getMetaConfig } = await import("../src/lib/ai/meta/config");
  const { extractLeadEvidence } = await import("../src/lib/ai/lead-evidence/extract");
  const { mapEvidenceToBuyerCriteriaInputs } = await import("../src/lib/ai/lead-evidence/domain-adapter");
  const { calculateBuyerScore } = await import("../src/domain/scoring/buyer-score");

  console.log("=================================================");
  console.log(" PROPERTY ADS INTELLIGENCE — META MODEL API SMOKE");
  console.log("=================================================");

  const config = getMetaConfig({ requireApiKey: false });
  console.log(`Endpoint Base URL : ${config.baseUrl}`);
  console.log(`Configured Model  : ${config.museSparkModel}`);
  console.log(`API Key Status    : ${maskApiKey(config.apiKey)}`);

  if (!config.isConfigured) {
    console.log("\n[SKIP] MODEL_API_KEY is not configured in environment.");
    console.log("To test live Meta Model API, add MODEL_API_KEY=<your-key> to .env.local.");
    console.log("Skipping live smoke test without error.");
    process.exit(0);
  }

  const sampleConversation = `
[10:00] Buyer: Halo admin, saya tertarik dengan Cluster Sapphire BSD Tipe 72 Hook.
[10:01] Sales: Halo Bapak! Terima kasih telah menghubungi BSD City. Tipe 72 Hook siap huni dengan luas tanah 120m2.
[10:02] Buyer: Apakah harganya masih sekitar 1,5 Miliar? Kami rencana mau survei lokasi hari Sabtu ini jika cocok.
[10:03] Sales: Betul sekali Pak, harga mulai 1,5 Miliar dengan promo DP 0%. Boleh kami jadwalkan survei Sabtu jam 10 pagi?
[10:04] Buyer: Baik, jadwalkan Sabtu jam 10 pagi ya. Terima kasih!
`.trim();

  console.log("\nSending synthetic transcript to Meta Model API (Muse Spark)...");
  const startTime = Date.now();

  try {
    const evidence = await extractLeadEvidence({
      conversationText: sampleConversation,
      leadContext: { contactName: "Bpk. Hendra", adName: "Cluster Sapphire BSD" },
      propertyContext: { projectName: "Cluster Sapphire BSD", startingPrice: 1500000000 },
    });

    const elapsed = Date.now() - startTime;
    console.log(`\n[SUCCESS] Extracted facts in ${elapsed}ms:`);
    console.log(`- Model Used         : ${evidence.model}`);
    console.log(`- Provider           : ${evidence.provider}`);
    console.log(`- Purchase Intent    : ${evidence.purchaseIntent}`);
    console.log(`- Budget Explicit    : ${evidence.budget?.isExplicit} (${evidence.budget?.currency} ${evidence.budget?.amount?.toLocaleString()})`);
    console.log(`- Preferred Location : ${evidence.preferredLocation}`);
    console.log(`- Readiness Next Step: ${evidence.readinessForNextStep}`);
    console.log(`- Confidence Score   : ${evidence.confidenceScore}`);
    console.log(`- Evidence Quotes    : ${evidence.evidenceQuotes.length} quotes extracted`);

    // Feed to deterministic scoring engine
    const criteriaInputs = mapEvidenceToBuyerCriteriaInputs(evidence);
    const scoreAssessment = calculateBuyerScore(criteriaInputs);

    console.log("\n[DETERMINISTIC DOMAIN ENGINE EVALUATION]");
    console.log(`- Buyer Score        : ${scoreAssessment.normalizedScore ?? "N/A"} / 100`);
    console.log(`- Completeness       : ${scoreAssessment.completeness}%`);
    console.log(`- Scoring Status     : ${scoreAssessment.status}`);
    console.log("=================================================");
  } catch (error) {
    console.error("\n[ERROR] Meta Model API smoke test failed:", error);
    process.exit(1);
  }
}

runSmokeTest();
