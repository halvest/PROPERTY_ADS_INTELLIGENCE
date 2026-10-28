import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface ProvisioningResult {
  organizationId: string;
  role: string;
  isNewOrganization: boolean;
}

/**
 * Idempotently provisions an organization and owner profile for a verified user.
 * If the user already has a profile and organization, returns the existing record.
 */
export async function ensureUserOrganizationAndProfile(
  userId: string,
  email: string,
  fullName?: string | null
): Promise<ProvisioningResult> {
  const admin = createAdminClient();

  // 1. Check if profile already exists
  const { data: existingProfile, error: profileCheckError } = await admin
    .from("profiles")
    .select("organization_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileCheckError) {
    throw new Error(`Gagal memeriksa profil pengguna: ${profileCheckError.message}`);
  }

  if (existingProfile?.organization_id) {
    return {
      organizationId: existingProfile.organization_id,
      role: existingProfile.role,
      isNewOrganization: false,
    };
  }

  // 2. Derive company / organization name
  const orgNamePrefix = fullName?.trim() || email.split("@")[0] || "Properti";
  const organizationName = `Organisasi ${orgNamePrefix}`;

  // 3. Create new organization
  const { data: newOrg, error: orgInsertError } = await admin
    .from("organizations")
    .insert({
      name: organizationName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (orgInsertError || !newOrg) {
    throw new Error(
      `Gagal membuat organisasi baru: ${orgInsertError?.message || "Kesalahan database"}`
    );
  }

  // 4. Create user profile with 'owner' role for their newly created organization
  const { data: newProfile, error: profileInsertError } = await admin
    .from("profiles")
    .insert({
      id: userId,
      organization_id: newOrg.id,
      full_name: fullName || orgNamePrefix,
      role: "owner",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("organization_id, role")
    .single();

  if (profileInsertError || !newProfile) {
    // Fallback: check if concurrent request created the profile
    const { data: concurrentProfile } = await admin
      .from("profiles")
      .select("organization_id, role")
      .eq("id", userId)
      .maybeSingle();

    if (concurrentProfile?.organization_id) {
      return {
        organizationId: concurrentProfile.organization_id,
        role: concurrentProfile.role,
        isNewOrganization: false,
      };
    }

    throw new Error(
      `Gagal membuat profil pengguna: ${profileInsertError?.message || "Kesalahan database"}`
    );
  }

  return {
    organizationId: newProfile.organization_id,
    role: newProfile.role,
    isNewOrganization: true,
  };
}
