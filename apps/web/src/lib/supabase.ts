import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { backendConfigured, env } from "./env";

let client: SupabaseClient | null = null;

/** Supabase client, or null in local-only mode (no backend configured). */
export function supabase(): SupabaseClient | null {
  if (!backendConfigured()) return null;
  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
