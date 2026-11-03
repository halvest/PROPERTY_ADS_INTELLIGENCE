import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAiAnalysisQuotaEnabled, readAiAnalysisUsage } from "@/lib/ai/usage-quota";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (!isAiAnalysisQuotaEnabled()) {
    return NextResponse.json({
      success: true,
      data: { enabled: false },
    }, { headers: { "Cache-Control": "no-store, private" } });
  }

  const usage = await readAiAnalysisUsage(user.id);
  if (!usage) {
    return NextResponse.json({ success: false, error: "Usage is temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    success: true,
    data: {
      enabled: true,
      limit: 3,
      used: usage.used_count,
      reserved: usage.reserved_count,
      remaining: usage.remaining_count,
      resetAt: usage.next_available_at,
    },
  }, { headers: { "Cache-Control": "no-store, private" } });
}
