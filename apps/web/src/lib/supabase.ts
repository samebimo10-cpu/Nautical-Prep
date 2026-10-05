import type { SupabaseClient } from "@supabase/supabase-js";
import { backendConfigured, env } from "./env";

let client: Promise<SupabaseClient> | null = null;

/** Supabase client (loaded on demand to keep the offline app shell small), or null in local-only mode. */
export async function supabase(): Promise<SupabaseClient | null> {
  if (!backendConfigured()) return null;
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } }),
  );
  return client;
}
