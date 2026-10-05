import { env } from "./env";
import { supabase } from "./supabase";

export interface Price {
  tier: "pro" | "pro_oral";
  country: string;
  currency: string;
  amountMinor: number;
}

export interface PaymentProvider {
  readonly id: string;
  supports(country: string): boolean;
  checkout(price: Price, email: string): Promise<{ reference: string }>;
}

declare global {
  interface Window {
    PaystackPop?: { setup(opts: Record<string, unknown>): { openIframe(): void } };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("failed to load payment script"));
    document.head.appendChild(s);
  });
}

/** Paystack inline checkout. The webhook Edge Function (payments-webhook) activates the subscription. */
export const paystack: PaymentProvider = {
  id: "paystack",
  supports: (c) => ["ng", "gh"].includes(c) || true,
  async checkout(price, email) {
    if (!env.paystackPublicKey) throw new Error("Payments are not configured yet.");
    await loadScript("https://js.paystack.co/v1/inline.js");
    const sb = supabase();
    const uid = sb ? (await sb.auth.getUser()).data.user?.id : undefined;
    return new Promise((resolve, reject) => {
      const ref = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      window.PaystackPop!.setup({
        key: env.paystackPublicKey,
        email,
        amount: price.amountMinor,
        currency: price.currency,
        ref,
        metadata: { user_id: uid, tier: price.tier, country: price.country },
        callback: () => resolve({ reference: ref }),
        onClose: () => reject(new Error("Payment cancelled")),
      }).openIframe();
    });
  },
};

export const providers: PaymentProvider[] = [paystack];
