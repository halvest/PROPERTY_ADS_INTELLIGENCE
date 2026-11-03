import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AIRevisionEngine } from "@/lib/ai/creative-studio/advanced-features";
import { AdCompositionEngine } from "@/lib/ai/creative-studio/composition-engine";
import { MuseImageProvider } from "@/lib/ai/creative-studio/muse-provider";
import { AdPosterSynthesizer } from "@/lib/ai/creative-studio/ad-poster-synthesizer";
import { CreativeBriefSchema } from "@/lib/ai/creative-studio/types";
import type { CreativeStrategy, AspectRatio } from "@/lib/ai/creative-studio/types";

export const maxDuration = 60;

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

    // 1. Pure Conversational Meta Muse Image 1.0 Studio Revision
    if (!body.currentStrategy && (body.prompt || body.instruction)) {
      const promptText = (body.prompt || body.instruction || "").trim();
      if (!promptText) {
        return NextResponse.json(
          { success: false, error: "Revision prompt cannot be empty" },
          { status: 400 }
        );
      }

      const studioResult = await MuseImageProvider.generateStudioImage({
        prompt: promptText,
        images: Array.isArray(body.images) ? body.images : body.baseImageUrl ? [body.baseImageUrl] : [],
        aspectRatio: body.aspectRatio || "4:5",
        previousResponseId: body.previousResponseId || null,
      });

      return NextResponse.json({
        success: true,
        imageUrl: studioResult.imageUrl,
        responseId: studioResult.responseId,
        reasoning: studioResult.reasoning,
        aspectRatio: studioResult.aspectRatio,
        nativeSize: studioResult.nativeSize,
        generationTimeMs: studioResult.generationTimeMs,
        isFallback: studioResult.isFallback,
      });
    }
    const {
      currentStrategy,
      brief: rawBrief,
      instruction,
      baseImageUrl,
      aspectRatio = "4:5",
      previousResponseId,
    } = body as {
      currentStrategy: CreativeStrategy;
      brief: unknown;
      instruction: string;
      baseImageUrl: string;
      aspectRatio: AspectRatio;
      previousResponseId?: string;
    };

    if (!instruction || !instruction.trim()) {
      return NextResponse.json(
        { success: false, error: "Revision instruction cannot be empty" },
        { status: 400 }
      );
    }

    const parsedBrief = CreativeBriefSchema.safeParse(rawBrief);
    if (!parsedBrief.success) {
      return NextResponse.json(
        { success: false, error: "Invalid brief data for revision" },
        { status: 400 }
      );
    }

    const brief = parsedBrief.data;
    const revision = AIRevisionEngine.applyRevision(
      currentStrategy,
      brief,
      instruction
    );

    // If instruction asks for visual, atmosphere, or lighting edits, invoke Muse Image 1.0 multi-turn
    let revisedImageUrl = baseImageUrl;
    let newResponseId = previousResponseId;
    let reasoningSummary: string | undefined = undefined;

    const intent = AIRevisionEngine.classifyIntent(instruction);
    if (intent === "copy") {
      const headlineMatch = instruction.match(/(?:headline|judul)\s*(?:menjadi|:)\s*(.+)$/i);
      if (headlineMatch?.[1]) brief.headline = headlineMatch[1].trim();
    }

    if (intent === "image" && previousResponseId) {
      try {
        const museResult = await MuseImageProvider.generateImage({
          prompt: instruction,
          aspectRatio,
          previousResponseId,
        });

        if (museResult.imageUrl && !museResult.isFallback) {
          revisedImageUrl = museResult.imageUrl;
          newResponseId = museResult.responseId;
          reasoningSummary = museResult.reasoningSummary;
        }
      } catch (err) {
        console.warn("[Multi-turn Muse Revise] Fallback to design token revision:", err);
      }
    }

    // If not updated by live Muse API, re-synthesize ad poster with the new brief changes
    if (revisedImageUrl === baseImageUrl) {
      try {
        const archetypeId = (revision.updatedStrategy.adArchetypeId || "emerald_minimalist") as any;
        const primaryAsset = brief.assets?.find((a) => a.isPrimary) || brief.assets?.[0];
        const photoUrl = primaryAsset?.previewUrl || baseImageUrl;

        revisedImageUrl = AdPosterSynthesizer.synthesize({
          archetypeId,
          aspectRatio,
          projectName: brief.projectName,
          propertyType: brief.propertyType,
          propertyLocation: brief.propertyLocation,
          startingPrice: brief.startingPrice,
          promoHeadline: brief.promoHeadline,
          headline: brief.headline,
          subheadline: brief.subheadline,
          bedrooms: brief.bedrooms,
          bathrooms: brief.bathrooms,
          buildingArea: brief.buildingArea,
          landArea: brief.landArea,
          contactNumber: brief.ctaText,
          photoUrl,
        });
      } catch (synthErr) {
        console.warn("[Revise Poster Synthesis Error]:", synthErr);
      }
    }

    const updatedComposedLayout = AdCompositionEngine.composeAd(
      brief,
      revision.updatedStrategy,
      revisedImageUrl || "",
      aspectRatio,
      revision.targetLayoutFamilyId
    );
    updatedComposedLayout.finalComposedUrl = revisedImageUrl;
    updatedComposedLayout.isPureGeneratedImage = true;

    return NextResponse.json({
      success: true,
      data: {
        creativeStrategy: revision.updatedStrategy,
        composedLayout: updatedComposedLayout,
        appliedChangesNote: revision.appliedChangesNote,
        revisionIntent: intent,
        responseId: newResponseId,
        reasoningSummary,
      },
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Error applying AI revision";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

