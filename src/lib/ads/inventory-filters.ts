import { objectiveFilterKey } from "@/lib/ads/result-metric";

export interface InventoryFilterableAd {
  campaignId: string | null;
  campaignStatus: string;
  campaignObjective: string | null;
  deliveryStatus: string;
  deliveryReason?: string;
}

export interface InventoryFilters {
  selectedCampaignId?: string | null;
  campaignStatusFilter?: string | null;
  deliveryStatusFilter?: string | null;
  objectiveFilter?: string | null;
}

/** Table filters. Account KPIs stay on the full selected account and period. */
export function matchesInventoryFilters(ad: InventoryFilterableAd, filters: InventoryFilters): boolean {
  const campaignId = filters.selectedCampaignId;
  if (campaignId && campaignId !== "all" && ad.campaignId !== campaignId) return false;

  const campaignStatus = filters.campaignStatusFilter;
  if (campaignStatus && campaignStatus !== "all") {
    if (campaignStatus === "all_active") {
      if (ad.campaignStatus !== "ACTIVE" && ad.campaignStatus !== "PAUSED") return false;
    } else if (ad.campaignStatus !== campaignStatus) {
      return false;
    }
  }

  const delivery = filters.deliveryStatusFilter;
  if (delivery && delivery !== "all") {
    if (delivery === "all_active") {
      if (ad.deliveryReason === "Diarsipkan" || ad.deliveryReason === "Dihapus") return false;
    } else if (delivery === "DELIVERING" && ad.deliveryStatus !== "DELIVERING") return false;
    else if (delivery === "NOT_DELIVERING" && ad.deliveryStatus !== "NOT_DELIVERING") return false;
    else if (delivery === "CAMPAIGN_PAUSED" && ad.deliveryReason !== "Campaign Dijeda") return false;
    else if (delivery === "AD_PAUSED" && ad.deliveryReason !== "Iklan Dijeda") return false;
    else if (delivery === "ARCHIVED" && ad.deliveryReason !== "Diarsipkan") return false;
    else if (delivery === "DELETED" && ad.deliveryReason !== "Dihapus") return false;
    else if (delivery === "UNKNOWN" && ad.deliveryStatus !== "UNKNOWN") return false;
  }

  const objective = filters.objectiveFilter;
  if (objective && objective !== "all" && objectiveFilterKey(ad.campaignObjective) !== objective) return false;

  return true;
}
