const STOP = new Set(
  "a an the and or of to in on at for by with from is are was were be been it its this that these those as into than then there their them they you your we our i me my he she his her not no do does did can could should would will shall may might must have has had what which who when where why how about any all each some such also if so very more most over under up down out off per via".split(
    " ",
  ),
);

/** Light stemmer: strips common English inflections so "loading/loaded/loads" ≈ "load". */
export function stem(w: string): string {
  if (/^\d/.test(w) || w.length <= 3) return w;
  let base = w;
  for (const suf of ["ations", "ation", "ings", "ing", "edly", "ies", "ied", "ed", "es", "ly", "s"]) {
    if (!w.endsWith(suf) || w.length - suf.length < 3) continue;
    if (suf === "s" && w.endsWith("ss")) break;
    base = w.slice(0, -suf.length);
    if (suf === "ies" || suf === "ied") base += "y";
    break;
  }
  // drop a final silent "e" so reduce/reduces/reduced all become "reduc"
  if (base.length > 4 && base.endsWith("e")) base = base.slice(0, -1);
  return base;
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9.]+/g, " ")
    .split(" ")
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean)
    .map(stem);
}

/** Space-padded normalised string, for phrase containment checks. */
export function normalised(text: string): string {
  return ` ${tokens(text).join(" ")} `;
}

export function significantTokens(text: string): string[] {
  return [...new Set(tokens(text).filter((t) => (t.length >= 3 || /^\d/.test(t)) && !STOP.has(t)))];
}
