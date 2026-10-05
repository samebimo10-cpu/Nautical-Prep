import { cors, context, enforceQuota, json, logUsage } from "../_shared/http.ts";
import { gradeWritten } from "../_shared/ai-core.ts";
import { makeModelCall } from "../_shared/claude.ts";
import { GRADE_SYSTEM } from "../_prompts/grade-answer.v1.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { admin, userId } = await context(req);
    const { item_id, answer } = await req.json();
    if (typeof item_id !== "string" || typeof answer !== "string" || answer.trim().length < 5) return json({ error: "item_id and answer required" }, 400);
    const { data: profile } = await admin.from("profiles").select("country").eq("user_id", userId).single();
    await enforceQuota(admin, userId, "grade", profile?.country ?? "uk");
    const { data: row } = await admin.from("items").select("body").eq("id", item_id).eq("type", "written").single();
    if (!row) return json({ error: "item not found" }, 404);
    const usage = { input: 0, output: 0 };
    const result = await gradeWritten(makeModelCall(usage), GRADE_SYSTEM, row.body, answer);
    await logUsage(admin, userId, "grade", usage);
    return json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: (e as Error).message }, 500);
  }
});
