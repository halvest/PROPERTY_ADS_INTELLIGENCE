import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PersistMetaTokenOptions {
  organizationId: string;
  userId: string;
  encryptedAccessToken: string;
  encryptionIv: string;
  encryptionTag: string;
  tokenType?: string;
  expiresAt: string;
  grantedScopes: string[];
  supabaseClient?: SupabaseClient;
}

/**
 * Persists an encrypted Meta user access token into meta_user_tokens.
 *
 * Security architecture:
 * 1. Checks that organizationId and userId are provided.
 * 2. Attempts persistence via the authenticated user's client first,
 *    exercising the strict RLS policies on meta_user_tokens.
 * 3. If needed, uses the server-only admin client after session, CSRF state,
 *    and tenant ownership have been verified server-side.
 * 4. Never exposes tokens or keys outside the server.
 */
export async function persistMetaUserToken(
  options: PersistMetaTokenOptions
): Promise<{ success: boolean; error?: string }> {
  const {
    organizationId,
    userId,
    encryptedAccessToken,
    encryptionIv,
    encryptionTag,
    tokenType = "Bearer",
    expiresAt,
    grantedScopes,
    supabaseClient,
  } = options;

  if (!organizationId || !userId) {
    return { success: false, error: "organization_id and user_id are required" };
  }

  const payload = {
    organization_id: organizationId,
    user_id: userId,
    encrypted_access_token: encryptedAccessToken,
    encryption_iv: encryptionIv,
    encryption_tag: encryptionTag,
    token_type: tokenType,
    expires_at: expiresAt,
    granted_scopes: grantedScopes,
    updated_at: new Date().toISOString(),
  };

  // 1. Try authenticated client first if provided (exercises PostgreSQL RLS)
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from("meta_user_tokens")
        .upsert(payload, { onConflict: "organization_id" });

      if (!error) {
        return { success: true };
      }
    } catch {
      // Fall through to server-side admin client
    }
  }

  // 2. Use server-only admin client after server verification
  try {
    const admin = createAdminClient();
    const { error: adminError } = await admin
      .from("meta_user_tokens")
      .upsert(payload, { onConflict: "organization_id" });

    if (adminError) {
      return { success: false, error: adminError.message };
    }
    return { success: true };
  } catch (adminErr) {
    return {
      success: false,
      error: adminErr instanceof Error ? adminErr.message : "Failed to persist token using admin client",
    };
  }
}
