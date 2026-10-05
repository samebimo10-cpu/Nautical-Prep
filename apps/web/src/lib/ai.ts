import { backendConfigured } from "./env";
import { supabase } from "./supabase";

export interface GradeResult {
  score: number;
  points_hit: string[];
  points_missed: string[];
  feedback: string;
}

export interface OralTurnResult {
  examiner_text: string;
  grade?: { item_id: string; score: number; points_hit: string[]; points_missed: string[]; low_confidence: boolean };
  done: boolean;
  verdict?: { passed: boolean; average: number; debrief: string };
  session_id: string;
}

export function aiAvailable(): boolean {
  return backendConfigured() && navigator.onLine;
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const sb = await supabase();
  if (!sb) throw new Error("AI features need the online backend (not configured).");
  if (!navigator.onLine) throw new Error("needs connection");
  const { data, error } = await sb.functions.invoke(fn, { body });
  if (error) throw error;
  return data as T;
}

export const gradeWritten = (item_id: string, answer: string) => invoke<GradeResult>("grade-answer", { item_id, answer });
export const oralTurn = (body: { session_id?: string; country: string; answer?: string; n?: number }) => invoke<OralTurnResult>("oral-examiner", body);
