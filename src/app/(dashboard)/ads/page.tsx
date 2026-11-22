import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdsIntelligenceData } from "@/lib/ads/service";
import AdsIntelligencePage, { type AdsIntelligenceApiResponse } from "@/components/ads/AdsWorkspace";

export default async function AdsPage() {
  await connection();
  let initialData: AdsIntelligenceApiResponse["data"] | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.organization_id) {
        const data = await getAdsIntelligenceData({
          organizationId: profile.organization_id,
          dateRange: "30d",
        });
        initialData = {
          ...data,
          canSync: ["owner", "admin", "supervisor"].includes(profile.role || ""),
        };
      }
    }
  } catch {
    initialData = null;
  }

  return <AdsIntelligencePage initialData={initialData} />;
}
