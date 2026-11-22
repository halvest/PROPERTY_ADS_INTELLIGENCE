export interface JustificationMetrics {
  spend: number | null;
  link_ctr: number | null;
  cpm: number | null;
  link_cpc: number | null;
  messaging_conversations: number | null;
  leads: number | null;
  cost_per_messaging_conversation: number | null;
  cost_per_lead: number | null;
  unique_reach: number | null;
}

export interface CtwaGroundTruthMetrics extends JustificationMetrics {
  impressions: number | null;
  link_clicks: number | null;
  all_clicks: number | null;
  frequency: number | null;
  results_legacy: number | null;
  cost_per_result_legacy: number | null;
}
