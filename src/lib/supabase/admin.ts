import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Creates an administrative Supabase client using the SERVICE ROLE key.
 * 
 * SECURITY RULES:
 * 1. This client BYPASSES Row Level Security (RLS).
 * 2. It must ONLY be used on the server in authorized routes/workers (e.g., webhooks, system sync).
 * 3. It must NEVER be exposed to the browser or imported in client components.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "[SECURITY VIOLATION] createAdminClient cannot be called in a browser context. Service-role key must never be leaked."
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "[Supabase Admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
