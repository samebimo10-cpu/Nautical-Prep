/** Verify Paystack webhook signature: HMAC-SHA512 of the raw body with the secret key (x-paystack-signature). */
export async function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export interface PaystackEvent {
  event: string;
  data: { reference: string; status: string; metadata?: { user_id?: string; tier?: string; country?: string }; paid_at?: string };
}

/** Map a verified Paystack event to a subscription row (30-day period), or null if not actionable. */
export function subscriptionFromEvent(e: PaystackEvent, now = new Date()) {
  if (e.event !== "charge.success" || e.data.status !== "success") return null;
  const m = e.data.metadata ?? {};
  if (!m.user_id || !m.tier || !m.country || !["pro", "pro_oral"].includes(m.tier)) return null;
  const end = new Date(now.getTime() + 30 * 86_400_000);
  return { user_id: m.user_id, tier: m.tier, country: m.country, provider: "paystack", provider_ref: e.data.reference, status: "active", current_period_end: end.toISOString() };
}
