import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NaturalLanguageBriefParser } from "@/lib/ai/creative-studio/brief-parser";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      text = "",
      angleId = "whatsapp_direct",
      aspectRatio = "4:5",
      assets = [],
    } = body;

    const parsedBrief = NaturalLanguageBriefParser.parse(text, {
      angleId,
      aspectRatio,
      assets,
    });

    return NextResponse.json({
      success: true,
      data: parsedBrief,
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Error parsing natural language brief";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

