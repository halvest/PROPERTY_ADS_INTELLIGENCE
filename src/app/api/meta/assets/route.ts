import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getAvailableAndSelectedMetaAssets,
  saveSelectedMetaAssets,
  saveSelectedMetaAccounts,
  removeSelectedMetaAccount,
  disconnectMetaAssets,
} from "@/lib/marketing/meta/asset-onboarding-service";

const SaveSelectionSchema = z.object({
  pageId: z.string().trim().nullable().optional(),
  pageName: z.string().trim().nullable().optional(),
  instagramAccountId: z.string().trim().nullable().optional(),
  instagramUsername: z.string().trim().nullable().optional(),
  adAccountId: z.string().trim().optional(),
  adAccountName: z.string().trim().nullable().optional(),
  accounts: z.array(z.string().trim().min(1)).max(50).optional(),
});

/**
 * GET /api/meta/assets
 * Retrieves available Facebook Pages, Instagram accounts, and Ad Accounts for the authenticated tenant.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return NextResponse.json(
        { success: false, error: "Organisasi tidak ditemukan", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const assets = await getAvailableAndSelectedMetaAssets(profile.organization_id);

    return NextResponse.json({
      success: true,
      pages: assets.pages,
      adAccounts: assets.adAccounts,
      selected: assets.selected,
      connectedAccounts: assets.connectedAccounts,
      tokenStatus: assets.tokenStatus,
      accountError: assets.accountError || null,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Kesalahan server internal";
    return NextResponse.json(
      { success: false, error: "Gagal mengambil daftar aset Meta: " + errorMsg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/meta/assets
 * Saves and activates the user's selected Meta assets (Page, Instagram, Ad Account) for their organization.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return NextResponse.json(
        { success: false, error: "Organisasi tidak ditemukan", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Role check: Only owner or admin can configure assets
    const allowedRoles = ["owner", "admin"];
    if (!profile.role || !allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Role pengguna '${profile.role}' tidak memiliki izin untuk mengubah aset Meta.`,
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Format JSON tidak valid", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const parseResult = SaveSelectionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validasi parameter gagal",
          code: "VALIDATION_ERROR",
          details: parseResult.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const accountIds =
      parseResult.data.accounts && parseResult.data.accounts.length > 0
        ? parseResult.data.accounts
        : parseResult.data.adAccountId
          ? [parseResult.data.adAccountId]
          : [];
    if (accountIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Pilih minimal satu akun iklan.", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (accountIds.length === 1 && !parseResult.data.accounts) {
      const saved = await saveSelectedMetaAssets(profile.organization_id, user.id, {
        ...parseResult.data,
        adAccountId: accountIds[0],
      });
      return NextResponse.json({
        success: true,
        message: "Aset Meta berhasil disimpan dan dihubungkan ke dashboard.",
        selected: saved,
      });
    }

    const result = await saveSelectedMetaAccounts(profile.organization_id, user.id, {
      adAccountIds: accountIds,
      pageId: parseResult.data.pageId,
    });

    return NextResponse.json({
      success: true,
      message: `${result.saved.length} akun iklan berhasil disimpan.`,
      selected: result.active,
      savedAccounts: result.saved,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Kesalahan server internal";
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan pilihan aset: " + errorMsg },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/meta/assets
 * Disconnects the selected Meta assets for the organization.
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return NextResponse.json(
        { success: false, error: "Organisasi tidak ditemukan", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const allowedRoles = ["owner", "admin"];
    if (!profile.role || !allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Role pengguna '${profile.role}' tidak memiliki izin untuk memutuskan aset Meta.`,
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    // Optional body { adAccountId } removes a single account; no body
    // disconnects the organization's whole Meta connection.
    let removeAccountId: string | null = null;
    try {
      const body = (await request.json()) as { adAccountId?: string };
      if (body?.adAccountId) removeAccountId = body.adAccountId;
    } catch {
      // Empty body = full disconnect
    }

    if (removeAccountId) {
      const result = await removeSelectedMetaAccount(profile.organization_id, removeAccountId);
      return NextResponse.json({
        success: true,
        message: "Akun iklan berhasil dihapus dari integrasi organisasi ini.",
        removed: result.removed,
        activeAdAccountId: result.activeAdAccountId,
      });
    }

    await disconnectMetaAssets(profile.organization_id);

    return NextResponse.json({
      success: true,
      message: "Koneksi aset Meta berhasil diputuskan.",
      connectionStatus: "disconnected",
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Kesalahan server internal";
    return NextResponse.json(
      { success: false, error: "Gagal memutuskan koneksi aset Meta: " + errorMsg },
      { status: 500 }
    );
  }
}
