import en from "./en";
import ar from "./ar";
import fil from "./fil";

export type Locale = "en" | "ar" | "fil";
const dicts: Record<Locale, Partial<Record<keyof typeof en, string>>> = { en, ar, fil };
let current: Locale = "en";

export function setLocale(l: Locale) {
  current = l;
  document.documentElement.lang = l;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
}
export function t(key: keyof typeof en): string {
  return dicts[current][key] ?? en[key];
}
