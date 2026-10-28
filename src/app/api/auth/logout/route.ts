import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request?: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    const response = NextResponse.json({
      success: true,
      message: "Berhasil keluar dari sesi.",
    });

    // Clear demo_mode cookie if set
    response.cookies.delete("demo_mode");

    // Proactively clear all Supabase auth and chunk cookies to prevent cookie accumulation
    const allCookies = request?.cookies ? request.cookies.getAll() : [];
    allCookies.forEach((c) => {
      if (c.name.startsWith("sb-")) {
        response.cookies.set(c.name, "", { maxAge: 0, path: "/" });
      }
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Gagal memproses logout: " + (err instanceof Error ? err.message : "Kesalahan server"),
      },
      { status: 500 }
    );
  }
}
