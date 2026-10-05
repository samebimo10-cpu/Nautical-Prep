import { useState } from "react";
import { useProfile } from "../../lib/hooks";
import { backendConfigured, env } from "../../lib/env";
import { entitlementsFor } from "../../lib/entitlements";
import { paystack } from "../../lib/payments";
import { supabase } from "../../lib/supabase";
import { trackEvent } from "../../lib/record";
import { useEffect } from "react";
import { Banner, Card, PageHeader } from "../../components/ui";

// DRAFT prices (minor units) — final pricing is a human decision (CONTENT_TODO.md).
const PRICES: Record<string, { currency: string; pro: number; pro_oral: number; fmt: (n: number) => string }> = {
  ng: { currency: "NGN", pro: 0, pro_oral: 0, fmt: (n) => `₦${(n / 100).toLocaleString()}` },
  gh: { currency: "GHS", pro: 0, pro_oral: 0, fmt: (n) => `GH₵${(n / 100).toLocaleString()}` },
  ph: { currency: "PHP", pro: 0, pro_oral: 0, fmt: (n) => `₱${(n / 100).toLocaleString()}` },
  uk: { currency: "GBP", pro: 0, pro_oral: 0, fmt: (n) => `£${(n / 100).toFixed(2)}` },
  sg: { currency: "SGD", pro: 0, pro_oral: 0, fmt: (n) => `S$${(n / 100).toFixed(2)}` },
  au: { currency: "AUD", pro: 0, pro_oral: 0, fmt: (n) => `A$${(n / 100).toFixed(2)}` },
  eg: { currency: "EGP", pro: 0, pro_oral: 0, fmt: (n) => `E£${(n / 100).toLocaleString()}` },
};

export function Paywall() {
  const profile = useProfile();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => void trackEvent("paywall_view"), []);
  if (!profile) return null;
  const p = PRICES[profile.country] ?? PRICES.uk!;
  const priced = p.pro > 0;
  const tiers = [
    { id: "free" as const, name: "Free", features: ["150-question bank", "1 mock exam", "Offline oral examiner", "Sea-time & eligibility tracker"] },
    {
      id: "pro" as const,
      name: "Pro",
      features: ["Full question bank & calculations", "Unlimited mocks", "COLREGs simulator", "AI written-answer grading (20/day)"],
    },
    {
      id: "pro_oral" as const,
      name: "Pro + Oral",
      features: ["Everything in Pro", "AI oral examiner (3 sessions/day)", "Country examiner personas", "Voice mode"],
    },
  ];
  async function buy(tier: "pro" | "pro_oral") {
    setMsg(null);
    try {
      const email = (await (await supabase())?.auth.getUser())?.data.user?.email;
      if (!email) throw new Error("Sign in first (Profile) so your purchase is linked to your account.");
      await paystack.checkout({ tier, country: profile!.country, currency: p.currency, amountMinor: p[tier] }, email);
      await trackEvent("purchase", { tier });
      setMsg("Payment received. Your plan activates once the payment is confirmed (usually seconds).");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function restore() {
    const sb = await supabase();
    if (!sb) return setMsg("Restore needs the online backend.");
    const { data } = await sb.from("subscriptions").select("tier,status,current_period_end").eq("status", "active").maybeSingle();
    setMsg(data ? `Active plan: ${data.tier} until ${data.current_period_end}` : "No active plan found.");
  }
  return (
    <div className="grid gap-3">
      <PageHeader title="Plans" back="/more" />
      {!backendConfigured() && <Banner tone="ok">Local build: all features are unlocked on this device.</Banner>}
      {(!priced || !env.paystackPublicKey) && <Banner tone="warn">Pricing and payments are not live yet.</Banner>}
      {msg && <Banner>{msg}</Banner>}
      {tiers.map((t) => {
        const e = entitlementsFor(t.id);
        return (
          <Card key={t.id}>
            <div className="flex items-center justify-between">
              <h2 className="h2">{t.name}</h2>
              <span className="font-bold">{t.id === "free" ? "Free" : priced ? p.fmt(p[t.id]) : "Price TBC"}</span>
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {t.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-slate-500">
              AI grades/day: {e.aiGradesPerDay} · AI orals/day: {e.aiOralPerDay}
            </p>
            {t.id !== "free" && (
              <button className="btn-primary mt-3 w-full" disabled={!priced || !env.paystackPublicKey} onClick={() => buy(t.id as "pro" | "pro_oral")}>
                Choose {t.name}
              </button>
            )}
          </Card>
        );
      })}
      <button className="btn-ghost" onClick={restore}>
        Restore purchase
      </button>
    </div>
  );
}
