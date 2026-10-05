/** Scenario score: 60% for the correct action, 40% for rule selection (Jaccard similarity). */
export function scoreScenario(actionCorrect: boolean, chosenRules: string[], correctRules: string[]): number {
  const a = new Set(chosenRules);
  const b = new Set(correctRules);
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  const jaccard = union ? inter / union : 0;
  return Math.round(((actionCorrect ? 0.6 : 0) + 0.4 * jaccard) * 100) / 100;
}

/** Map a light description to an SVG colour. */
export function lightColour(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes("red")) return "#ef4444";
  if (d.includes("green")) return "#22c55e";
  if (d.includes("yellow")) return "#facc15";
  if (d.includes("blue")) return "#3b82f6";
  return "#f8fafc";
}
