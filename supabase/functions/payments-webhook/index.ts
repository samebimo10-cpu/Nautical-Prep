import { createClient } from "@supabase/supabase-js";
import { subscriptionFromEvent, verifyPaystackSignature, type PaystackEvent } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
  const raw = await req.text();
  const ok = await verifyPaystackSignature(raw, req.headers.get("x-paystack-signature"), Deno.env.get("PAYSTACK_SECRET_KEY") ?? "");
  if (!ok) return new Response("invalid signature", { status: 401 });
  const row = subscriptionFromEvent(JSON.parse(raw) as PaystackEvent);
  if (row) {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("subscriptions").upsert(row, { onConflict: "user_id,country" });
    if (error) return new Response(error.message, { status: 500 });
  }
  return new Response("ok");
});
