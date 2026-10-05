import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { costUsd, quotaDecision, TIER_LIMITS } from "./ai-core.ts";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

/** Service-role client + the calling user (verified from their JWT). */
export async function context(req: Request): Promise<{ admin: SupabaseClient; userId: string }> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) throw new Response("unauthorized", { status: 401 });
  return { admin, userId: data.user.id };
}

export async function enforceQuota(admin: SupabaseClient, userId: string, kind: "grade" | "oral_turn", country: string) {
  const { data: sub } = await admin.from("subscriptions").select("tier,status,current_period_end").eq("user_id", userId).eq("country", country).eq("status", "active").maybeSingle();
  const tier = sub && (!sub.current_period_end || new Date(sub.current_period_end) > new Date()) ? sub.tier : "free";
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", kind).gte("created_at", since.toISOString());
  const monthStart = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), 1)).toISOString();
  const { data: spend } = await admin.from("ai_usage").select("cost_usd").gte("created_at", monthStart);
  const monthSpend = (spend ?? []).reduce((s: number, r: { cost_usd: number }) => s + Number(r.cost_usd), 0);
  const d = quotaDecision({ usedToday: count ?? 0, dailyLimit: TIER_LIMITS[tier]?.[kind] ?? 0, monthSpendUsd: monthSpend, monthlyCapUsd: Number(Deno.env.get("AI_MONTHLY_BUDGET_USD") ?? "0") });
  if (!d.allowed) throw json({ error: d.reason }, 429);
}

export async function logUsage(admin: SupabaseClient, userId: string, kind: string, u: { input: number; output: number }, lowConfidence = false) {
  await admin.from("ai_usage").insert({ user_id: userId, kind, input_tokens: u.input, output_tokens: u.output, cost_usd: costUsd(u.input, u.output), low_confidence: lowConfidence });
}
