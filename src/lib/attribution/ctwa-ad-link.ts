export interface TenantAdRecord {
  id: string;
  campaign_id: string;
  organization_id: string;
  provider_ad_id: string;
}

export interface VerifiedAdLink {
  adId: string;
  campaignId: string;
  attributionStatus: "verified";
}

/**
 * Links a CTWA referral to an ad only when exactly one ad in the same
 * organization has that Meta ad id. Names are never used. An unknown or
 * ambiguous id stays unattributed.
 */
export function linkVerifiedMetaAd(
  sourceId: string | null | undefined,
  ads: TenantAdRecord[],
  organizationId: string | null | undefined
): VerifiedAdLink | null {
  const providerAdId = sourceId?.trim() ?? "";
  if (!providerAdId || !organizationId) return null;
  const matches = ads.filter(
    (ad) => ad.organization_id === organizationId && ad.provider_ad_id === providerAdId
  );
  if (matches.length !== 1) return null;
  return {
    adId: matches[0].id,
    campaignId: matches[0].campaign_id,
    attributionStatus: "verified",
  };
}
