import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserOrganizationAndProfile } from "@/lib/auth/provisioning";

/**
 * POST /api/auth/provision
 * Ensures that an authenticated user has an organization and profile provisioned.
 * Called immediately after email OTP verification or first login.
 */
export async function POST() {
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

    if (!user.email_confirmed_at && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          success: false,
          error: "Alamat email belum diverifikasi. Harap verifikasi OTP terlebih dahulu.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    const fullName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      null;

    const result = await ensureUserOrganizationAndProfile(
      user.id,
      user.email || "user@propertyads.id",
      fullName
    );

    return NextResponse.json({
      success: true,
      message: result.isNewOrganization
        ? "Organisasi dan profil baru berhasil dibuat."
        : "Profil pengguna terkonfirmasi.",
      organizationId: result.organizationId,
      role: result.role,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Kesalahan server internal";
    return NextResponse.json(
      { success: false, error: "Gagal memproses inisialisasi akun: " + errorMsg },
      { status: 500 }
    );
  }
}
