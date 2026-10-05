import { cors, context, enforceQuota, json, logUsage } from "../_shared/http.ts";
import { oralStep, pickOralItems, startOralState, type OralItemLite, type OralState } from "../_shared/ai-core.ts";
import { makeModelCall } from "../_shared/claude.ts";
import { oralSystem } from "../_prompts/oral-examiner.v1.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { admin, userId } = await context(req);
    const { session_id, country, answer, n } = await req.json();
    const { data: rows } = await admin.from("items").select("id,competence,countries,body").eq("type", "oral").eq("status", Deno.env.get("CONTENT_MODE") === "dev" ? "draft" : "reviewed");
    const pool = (rows ?? []).filter((r: { countries: string[] }) => r.countries.includes("*") || r.countries.includes(country));
    const items = new Map<string, OralItemLite>(pool.map((r: { id: string; body: OralItemLite }) => [r.id, r.body]));

    if (!session_id) {
      const ids = pickOralItems(pool, Math.min(Number(n) || 10, 20), Date.now());
      if (!ids.length) return json({ error: "no oral items available" }, 404);
      const persona = ["uk", "ph", "ng", "gh", "sg", "au", "eg"].includes(country) ? country : "generic";
      const state = startOralState(persona, ids);
      const first = items.get(ids[0]!)!.question;
      const { data } = await admin.from("oral_sessions").insert({ user_id: userId, country, state, transcript: [{ role: "examiner", text: first }] }).select("id").single();
      return json({ session_id: data!.id, examiner_text: first, done: false });
    }

    await enforceQuota(admin, userId, "oral_turn", country);
    const { data: sess } = await admin.from("oral_sessions").select("state,transcript").eq("id", session_id).eq("user_id", userId).single();
    if (!sess) return json({ error: "session not found" }, 404);
    const usage = { input: 0, output: 0 };
    const step = await oralStep(makeModelCall(usage), oralSystem((sess.state as OralState).persona), sess.state as OralState, items, String(answer ?? ""));
    await logUsage(admin, userId, "oral_turn", usage, step.grade?.low_confidence ?? false);
    const transcript = [...(sess.transcript as unknown[]), { role: "candidate", text: answer }, { role: "examiner", text: step.examiner_text }];
    await admin.from("oral_sessions").update({ state: step.state, transcript, rubric_scores: step.state.results, verdict: step.verdict ? (step.verdict.passed ? "pass" : "fail") : null }).eq("id", session_id);
    return json({ session_id, examiner_text: step.examiner_text, grade: step.grade, done: step.done, verdict: step.verdict });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: (e as Error).message }, 500);
  }
});
