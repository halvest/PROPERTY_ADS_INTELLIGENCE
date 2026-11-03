import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { CreativeBriefSchema } from "@/lib/ai/creative-studio/types";
import { AICreativeDirector } from "@/lib/ai/creative-studio/creative-director";
import { MuseImageProvider } from "@/lib/ai/creative-studio/muse-provider";
import { AdCompositionEngine } from "@/lib/ai/creative-studio/composition-engine";
import { AIVariationsEngine } from "@/lib/ai/creative-studio/advanced-features";
import { AdTemplateRetrievalEngine } from "@/lib/ai/creative-studio/template-retrieval";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    // Retrieve organization ID from user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId = profile?.organization_id;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "Active organization profile required" }, { status: 400 });
    }

    const body = await req.json();

    // 1. Pure Conversational Meta Muse Image 1.0 Studio Request
    if (body.prompt && typeof body.prompt === "string" && !body.projectName) {
      const studioResult = await MuseImageProvider.generateStudioImage({
        prompt: body.prompt,
        images: Array.isArray(body.images) ? body.images : body.image ? [body.image] : [],
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
    const parsed = CreativeBriefSchema.safeParse(body);

    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    const brief = parsed.data;

    // 1. Resolve primary reference image if uploaded
    const primaryAsset = brief.assets.find((a) => a.isPrimary) || brief.assets[0];
    const referenceImageUrl = primaryAsset?.previewUrl;

    // 2. Retrieve Best Ad Reference Template from Supabase (Visual RAG)
    const matchedTemplate = await AdTemplateRetrievalEngine.retrieveBestTemplate(
      supabase,
      brief,
      organizationId
    );

    // 3. Plan Art Direction & Strategy via AI Creative Director
    const creativeStrategy = AICreativeDirector.planCreativeStrategy(
      brief,
      brief.aspectRatio,
      brief.stylePreset
    );

    // If template was retrieved from DB and user chose Auto Director, inject its design knowledge
    const isAutoDirector =
      !brief.stylePreset ||
      brief.stylePreset === "creative_freedom" ||
      brief.stylePreset === "auto_director";

    if (matchedTemplate && isAutoDirector) {
      if (!brief.headline && matchedTemplate.headline_hook) {
        brief.headline = matchedTemplate.headline_hook;
      }
      creativeStrategy.styleName = matchedTemplate.name;
    }

    // 4. Resolve Dimensions
    const dimensions = {
      "1:1": { width: 1080, height: 1080 },
      "4:5": { width: 1080, height: 1350 },
      "9:16": { width: 1080, height: 1920 },
    }[brief.aspectRatio];

    // 5. Generate Visual Backdrop via Muse Image Provider
    const fidelityMode = brief.fidelityMode || (referenceImageUrl ? "preserve_original" : "ai_atmosphere");
    const archetypeId = (
      (isAutoDirector ? matchedTemplate?.category : undefined) ||
      creativeStrategy.adArchetypeId ||
      "niche_modern"
    ) as any;

    const imageResult = await MuseImageProvider.generateImage({
      prompt: creativeStrategy.imagePrompt,
      aspectRatio: brief.aspectRatio,
      width: dimensions.width,
      height: dimensions.height,
      referenceImageUrl,
      fidelityMode,
      archetypeId,
      posterMetadata: {
        projectName:
          brief.projectName && brief.projectName.trim().toLowerCase() !== "exclusive residence"
            ? brief.projectName.trim()
            : "",
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
        contactNumber: brief.whatsappNumber || brief.ctaText || "Hubungi Kami",
        logoDataUrl: brief.logoDataUrl || null,
        specsText: brief.specsText,
      },
    });

    // 5. Compose Graphic & Typography Overlay (Hybrid Composition Engine)
    const uncroppedPhotoUrl = referenceImageUrl || imageResult.rawPhotoUrl || imageResult.imageUrl;
    const composedLayout = AdCompositionEngine.composeAd(
      brief,
      creativeStrategy,
      uncroppedPhotoUrl,
      brief.aspectRatio
    );
    // When live Meta Muse Image API synthesized a complete brochure flyer, use it directly
    const isLiveAiGeneration = !imageResult.isFallback;
    const usePureGeneratedFlyer = isLiveAiGeneration && (brief.fidelityMode !== "preserve_original" || !referenceImageUrl);
    composedLayout.finalComposedUrl = usePureGeneratedFlyer ? imageResult.imageUrl : undefined;
    composedLayout.isPureGeneratedImage = usePureGeneratedFlyer;
    composedLayout.adArchetypeId = archetypeId;

    // 6. Evaluate Quality Scores & Pre-Flight Standards
    const qualityScore = AICreativeDirector.evaluateQualityScore(brief, composedLayout);

    // 7. Persist to Database (creative_projects & creative_generations)
    let projectId: string | null = null;
    let generationId: string | null = null;

    try {
      const { data: projectRow } = await supabase
        .from("creative_projects")
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          project_name: brief.projectName,
          campaign_name: brief.campaignName || null,
          headline: brief.headline || null,
          subheadline: brief.subheadline || null,
          description: brief.description || null,
          property_type: brief.propertyType || null,
          property_location: brief.propertyLocation || null,
          starting_price: brief.startingPrice ? Number(brief.startingPrice.replace(/[^0-9]/g, "")) || null : null,
          land_area: brief.landArea ? Number(brief.landArea) || null : null,
          building_area: brief.buildingArea ? Number(brief.buildingArea) || null : null,
          bedrooms: brief.bedrooms ? Number(brief.bedrooms) || null : null,
          bathrooms: brief.bathrooms ? Number(brief.bathrooms) || null : null,
          floors: brief.floors ? Number(brief.floors) || null : null,
          promo_headline: brief.promoHeadline || null,
          cashback_amount: brief.cashback ? Number(brief.cashback.replace(/[^0-9]/g, "")) || null : null,
          has_free_ppn: brief.hasFreePpn,
          dp_amount: brief.dpAmount ? Number(brief.dpAmount.replace(/[^0-9]/g, "")) || null : null,
          monthly_installment: brief.monthlyInstallment ? Number(brief.monthlyInstallment.replace(/[^0-9]/g, "")) || null : null,
          kpr_rate: brief.kprRate ? Number(brief.kprRate.replace(/[^0-9.]/g, "")) || null : null,
          promo_deadline: brief.promoDeadline || null,
          cta_text: brief.ctaText || "Hubungi Kami",
        })
        .select("id")
        .single();

      if (projectRow) {
        projectId = projectRow.id;

        const { data: genRow } = await supabase
          .from("creative_generations")
          .insert({
            project_id: projectId,
            organization_id: organizationId,
            user_id: user.id,
            aspect_ratio: brief.aspectRatio,
            style_preset: brief.stylePreset,
            width: dimensions.width,
            height: dimensions.height,
            raw_image_url: imageResult.imageUrl,
            final_composed_url: imageResult.imageUrl,
            creative_direction: creativeStrategy as unknown as Json,
            prompt_used: creativeStrategy.imagePrompt,
            quality_score: qualityScore as unknown as Json,
            status: "completed",
          })
          .select("id")
          .single();

        if (genRow) {
          generationId = genRow.id;
        }
      }
    } catch {
      // Non-blocking database insertion error
    }

    const genSafeId = generationId || `gen-${Date.now()}`;
    const projectSafeId = projectId || `proj-${Date.now()}`;

    // 8. Generate 3 Variations
    const variations = AIVariationsEngine.generateVariations(
      brief,
      imageResult.imageUrl,
      brief.aspectRatio,
      genSafeId
    );

    return NextResponse.json({
      success: true,
      data: {
        id: genSafeId,
        projectId: projectSafeId,
        aspectRatio: brief.aspectRatio,
        stylePreset: brief.stylePreset,
        dimensions,
        imageUrl: imageResult.imageUrl,
        composedLayout,
        creativeStrategy,
        qualityScore,
        provider: imageResult.provider,
        modelUsed: imageResult.modelUsed,
        responseId: imageResult.responseId,
        imageCallId: imageResult.imageCallId,
        reasoningSummary: imageResult.reasoningSummary,
        matchedTemplate: matchedTemplate
          ? {
              name: matchedTemplate.name,
              slug: matchedTemplate.slug,
              category: matchedTemplate.category,
              previewImageUrl: matchedTemplate.preview_image_url,
            }
          : null,
        variations,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error in Creative Generation";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
