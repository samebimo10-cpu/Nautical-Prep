export const COUNTRY_LIST = [
  { code: "ph", name: "Philippines", authority: "MARINA", flag: "🇵🇭", wave: 1 },
  { code: "ng", name: "Nigeria", authority: "NIMASA", flag: "🇳🇬", wave: 1 },
  { code: "uk", name: "United Kingdom", authority: "MCA", flag: "🇬🇧", wave: 1 },
  { code: "gh", name: "Ghana", authority: "GMA", flag: "🇬🇭", wave: 2 },
  { code: "sg", name: "Singapore", authority: "MPA", flag: "🇸🇬", wave: 2 },
  { code: "au", name: "Australia", authority: "AMSA", flag: "🇦🇺", wave: 3 },
  { code: "eg", name: "Egypt", authority: "EAMS", flag: "🇪🇬", wave: 3 },
] as const;

/** Waves enabled in this build. Wave 3 is listed but "coming soon". */
export const ENABLED_WAVES = new Set([1, 2]);

export const PERSONA_BY_COUNTRY: Record<string, string> = { uk: "uk", ph: "ph", ng: "ng", gh: "gh", sg: "sg", au: "au", eg: "eg" };

export function countryName(code: string): string {
  return COUNTRY_LIST.find((c) => c.code === code)?.name ?? code.toUpperCase();
}
