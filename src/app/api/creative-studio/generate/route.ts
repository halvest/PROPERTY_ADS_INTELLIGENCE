import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { CreativeBriefSchema } from "@/lib/ai/creative-studio/types";
import { AICreativeDirector } from "@/lib/ai/creative-studio/creative-director";
import { MuseImageProvider } from "@/lib/ai/creative-studio/muse-provider";
import { AdCompositionEngine } from "@/lib/ai/creative-studio/composition-engine";
import { AIVariationsEngine } from "@/lib/ai/creative-studio/advanced-features";
import { AdTemplateRetrievalEngine } from "@/lib/ai/creative-studio/template-retrieval";

export const maxDuration = 300;

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

    // =========================================================================
    // 1. Conversational Studio Generation (Chat-First Persistent Pipeline)
    // =========================================================================
    if (body.prompt && typeof body.prompt === "string" && !body.projectName) {
      const userPrompt = body.prompt.trim();
      const inputImages: string[] = Array.isArray(body.images)
        ? body.images
        : body.image
        ? [body.image]
        : [];
      const userRatio = body.aspectRatio || "auto";
      const parentGenId = body.parentGenerationId || null;
      let convoId = body.conversationId || null;
      const projectId = body.projectId || null;

      // 1.1 Ensure persistent conversation session exists
      if (!convoId) {
        // Derive clean initial title from prompt
        const rawTitle = userPrompt.length > 50 ? `${userPrompt.slice(0, 48)}...` : userPrompt;
        const cleanTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

        const { data: newConvo, error: createConvoErr } = await supabase
          .from("studio_conversations")
          .insert({
            organization_id: organizationId,
            user_id: user.id,
            project_id: projectId,
            title: cleanTitle || "Percakapan Kreatif Baru",
            is_pinned: false,
          })
          .select("id")
          .single();

        if (newConvo) {
          convoId = newConvo.id;
        } else if (createConvoErr) {
          console.warn("[Studio Conversation Create Warning]:", createConvoErr.message);
        }
      }

      // 1.2 Persist User Message into Timeline
      let userMsgId: string | null = null;
      if (convoId) {
        const { data: userMsg } = await supabase
          .from("studio_messages")
          .insert({
            conversation_id: convoId,
            organization_id: organizationId,
            user_id: user.id,
            role: "user",
            content: userPrompt,
            attachments: inputImages.map((img) => ({
              type: "image",
              url: img.length > 200 ? `${img.slice(0, 60)}...[data-url]` : img,
            })),
          })
          .select("id")
          .single();

        if (userMsg) userMsgId = userMsg.id;
      }

      // 1.3 Retrieve Relevant Creative Memory & Preferences
      const userPreferences: string[] = [];
      let projectContextText = "";

      try {
        const { data: memories } = await supabase
          .from("studio_memories")
          .select("category, key, value")
          .eq("organization_id", organizationId);

        if (memories && memories.length > 0) {
          for (const m of memories) {
            if (m.category === "user_preference") {
              userPreferences.push(`${m.key}: ${m.value}`);
            } else if (m.category === "project_memory" && projectId) {
              projectContextText += `${m.key}: ${m.value}\n`;
            }
          }
        }
      } catch (memErr) {
        console.warn("[Studio Memory Retrieval Warning]:", memErr);
      }

      const requestedDirection = body.creativeDirection;
      const creativeDirection = requestedDirection === "premium_editorial"
        || requestedDirection === "commercial_performance"
        || requestedDirection === "architectural_portfolio"
        ? requestedDirection
        : undefined;

      // 1.4 Generate Studio Image via Provider
      const studioResult = await MuseImageProvider.generateStudioImage({
        prompt: userPrompt,
        images: inputImages,
        aspectRatio: userRatio,
        previousResponseId: body.previousResponseId || null,
        creativeDirection,
        userPreferences: userPreferences.length > 0 ? userPreferences : undefined,
        projectContext: projectContextText ? projectContextText.trim() : undefined,
      });

      // 1.5 Persist Generation Record into Database
      let generationId: string | null = null;
      const dimMap: Record<string, { width: number; height: number }> = {
        "1:1": { width: 1080, height: 1080 },
        "4:5": { width: 1080, height: 1350 },
        "2:3": { width: 1080, height: 1620 },
        "9:16": { width: 1080, height: 1920 },
        "16:9": { width: 1920, height: 1080 },
        auto: { width: 1080, height: 1350 },
      };
      const dims = dimMap[studioResult.aspectRatio] || dimMap["4:5"];

      try {
        const { data: genRow, error: genErr } = await supabase
          .from("creative_generations")
          .insert({
            organization_id: organizationId,
            user_id: user.id,
            conversation_id: convoId,
            parent_generation_id: parentGenId,
            project_id: projectId,
            aspect_ratio: studioResult.aspectRatio,
            style_preset: "natural_creative",
            width: dims.width,
            height: dims.height,
            raw_image_url: studioResult.imageUrl,
            final_composed_url: studioResult.imageUrl,
            prompt_used: userPrompt,
            revision_instruction: parentGenId ? userPrompt : null,
            model_used: studioResult.modelUsed || "muse-image-1.0",
            provider: studioResult.provider || "meta_muse",
            status: "completed",
            creative_direction: {
              reasoning: studioResult.reasoning,
              nativeSize: studioResult.nativeSize,
              isFallback: studioResult.isFallback,
              modelLog: studioResult.modelLog || [],
              artDirections: studioResult.artDirections || [],
            } as unknown as Json,
          })
          .select("id")
          .single();

        if (genRow) {
          generationId = genRow.id;
        } else if (genErr) {
          console.warn("[Creative Generation DB Save Warning]:", genErr.message);
        }
      } catch (dbErr) {
        console.warn("[Creative Generation DB Exception]:", dbErr);
      }

      // 1.6 Persist Assistant Response Message
      let assistantMsgId: string | null = null;
      if (convoId) {
        const { data: assistantMsg } = await supabase
          .from("studio_messages")
          .insert({
            conversation_id: convoId,
            organization_id: organizationId,
            user_id: user.id,
            role: "assistant",
            content: studioResult.reasoning || "Visual berhasil dibuat sesuai arahan kreatif Anda.",
            attachments: [],
            generation_id: generationId,
          })
          .select("id")
          .single();

        if (assistantMsg) assistantMsgId = assistantMsg.id;

        // Update conversation timestamp
        await supabase
          .from("studio_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convoId);
      }

      return NextResponse.json({
        success: true,
        conversationId: convoId,
        userMessageId: userMsgId,
        assistantMessageId: assistantMsgId,
        generationId,
        imageUrl: studioResult.imageUrl,
        responseId: studioResult.responseId,
        reasoning: studioResult.reasoning,
        aspectRatio: studioResult.aspectRatio,
        nativeSize: studioResult.nativeSize,
        generationTimeMs: studioResult.generationTimeMs,
        isFallback: studioResult.isFallback,
        provider: studioResult.provider,
        modelUsed: studioResult.modelUsed,
        fallbackReason: studioResult.fallbackReason,
        adFacts: studioResult.adFacts,
        modelLog: studioResult.modelLog || [],
        artDirections: studioResult.artDirections || [],
      });
    }

    // =========================================================================
    // 2. Structured Brief Generation (Legacy Fallback Support)
    // =========================================================================
    const parsed = CreativeBriefSchema.safeParse(body);

    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    const brief = parsed.data;

    // Resolve primary reference image if uploaded
    const primaryAsset = brief.assets.find((a) => a.isPrimary) || brief.assets[0];
    const referenceImageUrl = primaryAsset?.previewUrl;

    // Retrieve Best Ad Reference Template from Supabase (Visual RAG)
    const matchedTemplate = await AdTemplateRetrievalEngine.retrieveBestTemplate(
      supabase,
      brief,
      organizationId
    );

    // Plan Art Direction & Strategy via AI Creative Director
    const creativeStrategy = AICreativeDirector.planCreativeStrategy(
      brief,
      brief.aspectRatio,
      brief.stylePreset
    );

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

    // Resolve Dimensions
    const dimensions = {
      "1:1": { width: 1080, height: 1080 },
      "4:5": { width: 1080, height: 1350 },
      "9:16": { width: 1080, height: 1920 },
    }[brief.aspectRatio];

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

    const uncroppedPhotoUrl = referenceImageUrl || imageResult.rawPhotoUrl || imageResult.imageUrl;
    const composedLayout = AdCompositionEngine.composeAd(
      brief,
      creativeStrategy,
      uncroppedPhotoUrl,
      brief.aspectRatio
    );
    const isLiveAiGeneration = !imageResult.isFallback;
    const usePureGeneratedFlyer = isLiveAiGeneration && (brief.fidelityMode !== "preserve_original" || !referenceImageUrl);
    composedLayout.finalComposedUrl = usePureGeneratedFlyer ? imageResult.imageUrl : undefined;
    composedLayout.isPureGeneratedImage = usePureGeneratedFlyer;
    composedLayout.adArchetypeId = archetypeId;

    const qualityScore = AICreativeDirector.evaluateQualityScore(brief, composedLayout);

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
