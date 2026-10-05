/** Runtime configuration. Only public values here — never secrets (see scripts/check-secrets.mjs). */
export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "",
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "",
  paystackPublicKey: (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined) ?? "",
  contentMode: ((import.meta.env.VITE_CONTENT_MODE as string | undefined) ?? "dev") as "dev" | "prod",
};

export const backendConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);

/** Dev/e2e hook: a plain HTTP endpoint that receives sync batches (set in localStorage). */
export function devSyncUrl(): string | null {
  try {
    return localStorage.getItem("cm.devSyncUrl");
  } catch {
    return null;
  }
}
