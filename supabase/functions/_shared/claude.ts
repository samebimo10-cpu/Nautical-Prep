// Deno-only: wraps the Anthropic SDK as a ModelCall with structured outputs.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GradeResult, OralGrade, type ModelCall } from "./ai-core.ts";

export const MODEL = "claude-opus-5-5";

export interface Usage {
  input: number;
  output: number;
}

export function makeModelCall(usage: Usage): ModelCall {
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  return async (system, user, schema) => {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "medium", format: zodOutputFormat(schema === "grade" ? GradeResult : OralGrade) },
      system,
      messages: [{ role: "user", content: user }],
    });
    usage.input += response.usage.input_tokens;
    usage.output += response.usage.output_tokens;
    if (response.stop_reason === "refusal") throw new Error("model declined to grade this answer");
    return response.parsed_output;
  };
}
