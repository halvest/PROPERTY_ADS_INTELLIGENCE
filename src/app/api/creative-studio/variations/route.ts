import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AIVariationsEngine } from "@/lib/ai/creative-studio/advanced-features";
import { CreativeBriefSchema } from "@/lib/ai/creative-studio/types";
import type { AspectRatio } from "@/lib/ai/creative-studio/types";

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
      brief: rawBrief,
      baseImageUrl,
      aspectRatio = "4:5",
      generationId = `gen-${Date.now()}`,
    } = body as {
      brief: unknown;
      baseImageUrl: string;
      aspectRatio: AspectRatio;
      generationId?: string;
    };

    const parsedBrief = CreativeBriefSchema.safeParse(rawBrief);
    if (!parsedBrief.success) {
      return NextResponse.json(
        { success: false, error: "Invalid brief data for generating variations" },
        { status: 400 }
      );
    }

    const brief = parsedBrief.data;
    const variations = AIVariationsEngine.generateVariations(
      brief,
      baseImageUrl,
      aspectRatio,
      generationId
    );

    return NextResponse.json({
      success: true,
      data: variations,
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Error generating creative variations";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

