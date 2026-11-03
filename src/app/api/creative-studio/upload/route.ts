import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId = profile?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "Active organization profile required" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "facade";
    const projectId = formData.get("projectId") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Validate mime type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Unsupported image format. Use JPG, PNG, WEBP, or SVG" },
        { status: 400 }
      );
    }

    const fileExt = file.name.split(".").pop() || "jpg";
    const sanitizedName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = `${organizationId}/${Date.now()}_${sanitizedName}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let publicUrl = "";

    // Attempt upload to Supabase Storage bucket 'property-creatives'
    const { error: uploadError } = await supabase.storage
      .from("property-creatives")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("property-creatives")
        .getPublicUrl(filePath);
      publicUrl = urlData.publicUrl;
    } else {
      // Fallback: create data URL so generation continues seamlessly if storage is not connected
      const base64 = buffer.toString("base64");
      publicUrl = `data:${file.type};base64,${base64}`;
    }

    // Save to creative_assets if projectId provided
    if (projectId && projectId.startsWith("proj-") === false) {
      try {
        await supabase.from("creative_assets").insert({
          project_id: projectId,
          organization_id: organizationId,
          category,
          file_name: file.name,
          file_url: publicUrl,
          file_size_bytes: file.size,
          mime_type: file.type,
          is_primary: category === "facade",
        });
      } catch {
        // Non-blocking asset tracking
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        name: file.name,
        size: file.size,
        category,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Error uploading creative asset";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

