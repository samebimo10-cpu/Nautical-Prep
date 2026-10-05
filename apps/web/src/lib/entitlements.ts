import { backendConfigured } from "./env";

export type Tier = "free" | "pro" | "pro_oral";

export interface Entitlements {
  tier: Tier;
  bankLimit: number | null; // max practice items available (null = all)
  mocksAllowed: number | null;
  offlineOral: boolean;
  aiOralPerDay: number;
  aiGradesPerDay: number;
}

/** Tier rules (draft pricing — see CONTENT_TODO.md). Server enforces the AI quotas too. */
export function entitlementsFor(tier: Tier): Entitlements {
  switch (tier) {
    case "pro_oral":
      return { tier, bankLimit: null, mocksAllowed: null, offlineOral: true, aiOralPerDay: 3, aiGradesPerDay: 40 };
    case "pro":
      return { tier, bankLimit: null, mocksAllowed: null, offlineOral: true, aiOralPerDay: 0, aiGradesPerDay: 20 };
    default:
      return { tier: "free", bankLimit: 150, mocksAllowed: 1, offlineOral: true, aiOralPerDay: 0, aiGradesPerDay: 3 };
  }
}

/** Without a backend (local/dev build) everything is unlocked and labelled as such. */
export function localTier(): Tier {
  return backendConfigured() ? "free" : "pro_oral";
}
