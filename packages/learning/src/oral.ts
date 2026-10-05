import { keyPointText, type KeyPoint, type OralItem } from "@cm/content-schema";
import { mulberry32 } from "@cm/calc";
import { normalised, significantTokens } from "./text";

export interface KeyPointResult {
  point: string;
  hit: boolean;
}

export interface OralGrade {
  score: number; // 0..1
  hit: string[];
  missed: string[];
  points: KeyPointResult[];
}

/** Does the normalised answer contain any of the "a|b|c" alternatives? */
function groupMatches(norm: string, group: string): boolean {
  return group
    .split("|")
    .map((alt) => normalised(alt))
    .some((alt) => alt.trim().length > 0 && norm.includes(alt));
}

export function keyPointHit(answer: string, kp: KeyPoint): boolean {
  const norm = normalised(answer);
  if (typeof kp === "string") {
    const sig = significantTokens(kp);
    if (sig.length === 0) return false;
    const present = sig.filter((t) => norm.includes(` ${t} `)).length;
    return present / sig.length >= 0.5;
  }
  const n = kp.match.length;
  const need = kp.min_groups ?? (n <= 2 ? n : Math.ceil(n * 0.6));
  const got = kp.match.filter((g) => groupMatches(norm, g)).length;
  return got >= need;
}

/**
 * Offline grading of a spoken/typed oral answer against the item's key points.
 * This is deliberately conservative keyword matching; the AI examiner (online) does
 * semantic grading. Both report against the same key points.
 */
export function gradeOral(item: Pick<OralItem, "key_points">, answer: string): OralGrade {
  const points = item.key_points.map((kp) => ({ point: keyPointText(kp), hit: keyPointHit(answer, kp) }));
  const hit = points.filter((p) => p.hit).map((p) => p.point);
  const missed = points.filter((p) => !p.hit).map((p) => p.point);
  return { score: points.length ? hit.length / points.length : 0, hit, missed, points };
}

// ---------------------------------------------------------------------------
// Offline examiner session (state machine)
// ---------------------------------------------------------------------------

export interface Persona {
  id: string;
  name: string;
  greeting: string;
  probe: string[];
  next: string[];
  close: string;
}

export const PERSONAS: Record<string, Persona> = {
  uk: {
    id: "uk",
    name: "MCA-style examiner",
    greeting:
      "Good morning. I'm your examiner today. I'll be asking you questions as if you are the Chief Mate of the vessel. Take your time, answer as you would on board, and if you don't know, say so. Shall we begin?",
    probe: ["Is there anything else you would consider?", "And what else?", "Expand on that for me, Mate.", "You're the Chief Mate — what more would you do?"],
    next: ["Thank you. Let's move on.", "Right. Next question.", "OK. Moving on."],
    close: "That concludes the examination. Please wait while I consider my decision.",
  },
  ph: {
    id: "ph",
    name: "Assessor (Philippines-style)",
    greeting: "Good day, Second Officer. This is your oral assessment for Chief Mate. Answer clearly and completely. Let us start.",
    probe: ["What else? Complete your answer.", "Kindly elaborate.", "Is that all? Think about the requirements."],
    next: ["Noted. Next question.", "Okay, proceed to the next."],
    close: "That ends your assessment. Here is your result.",
  },
  ng: {
    id: "ng",
    name: "Examiner (Nigeria-style)",
    greeting: "Good morning, Officer. You are here for your Chief Mate oral examination. Relax and answer as the Chief Mate. Let's start.",
    probe: ["Go on — what else?", "Is that all you will do as Chief Mate?", "Expand on that."],
    next: ["Alright. Next.", "Okay, let's move to another area."],
    close: "We have come to the end. Let me give you my assessment.",
  },
  gh: {
    id: "gh",
    name: "Examiner (Ghana-style)",
    greeting: "Good morning, Officer. Welcome to your Chief Mate oral examination. Please answer as the Chief Mate on board.",
    probe: ["Anything more?", "Tell me more about that.", "What else would you consider?"],
    next: ["Thank you. Next question.", "Fine. Let's continue."],
    close: "That is the end of the examination.",
  },
  sg: {
    id: "sg",
    name: "Examiner (Singapore-style)",
    greeting: "Good morning. This is your oral examination for Chief Mate. Answers should be precise and refer to the relevant regulations where you can.",
    probe: ["Which regulation covers that?", "Be more specific, please.", "What else?"],
    next: ["Okay. Next.", "Thank you. Moving on."],
    close: "The examination is complete.",
  },
  au: {
    id: "au",
    name: "Examiner (Australia-style)",
    greeting: "G'day. I'll be your examiner. I'll put some scenarios to you as Chief Mate — talk me through what you'd do.",
    probe: ["Talk me through what else you'd do.", "What else would you be thinking about?", "Anything else?"],
    next: ["No worries. Next one.", "Righto, moving on."],
    close: "That's the end of the assessment.",
  },
  eg: {
    id: "eg",
    name: "Examiner (Egypt-style)",
    greeting: "Good morning, Officer. Your Chief Mate oral examination begins now. Answer completely, please.",
    probe: ["Complete your answer, please.", "What else?", "Explain more."],
    next: ["Good. Next question.", "Okay. Next."],
    close: "The examination is finished.",
  },
  generic: {
    id: "generic",
    name: "Examiner",
    greeting: "Good morning. This is your Chief Mate oral examination. Answer each question as the Chief Mate on board.",
    probe: ["What else?", "Can you expand on that?", "Anything more?"],
    next: ["Thank you. Next question.", "OK, moving on."],
    close: "That concludes the examination.",
  },
};

export type OralMode = "exam" | "coach";

export interface OralTurn {
  role: "examiner" | "candidate" | "coach";
  text: string;
  item_id?: string;
}

export interface OralQuestionResult {
  item_id: string;
  score: number;
  hit: string[];
  missed: string[];
  critical: boolean;
  followUpAsked: boolean;
  answer: string;
}

export interface OralSession {
  country: string;
  persona: string;
  mode: OralMode;
  itemIds: string[];
  index: number;
  phase: "intro" | "question" | "probe" | "done";
  turns: OralTurn[];
  pendingAnswer: string;
  results: OralQuestionResult[];
  seed: number;
  startedAt: string;
}

/** Pass rule (draft, see DECISIONS.md): average ≥ 70% AND no safety-critical question below 50%. */
export const ORAL_PASS_AVG = 0.7;
export const ORAL_CRITICAL_MIN = 0.5;
/** A probe is asked when the first answer covers less than this share of key points. */
export const PROBE_BELOW = 0.6;

function pick<T>(arr: T[], seed: number, n: number): T {
  const r = mulberry32(seed + n * 7919)();
  return arr[Math.floor(r * arr.length)]!;
}

export function selectOralItems(items: OralItem[], n: number, seed: number, preferIds: string[] = []): string[] {
  const rng = mulberry32(seed);
  const pref = items.filter((i) => preferIds.includes(i.id));
  const rest = items.filter((i) => !preferIds.includes(i.id));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  // interleave competences so the examiner jumps between areas, like a real oral
  const chosen = [...pref, ...rest].slice(0, Math.max(n * 3, n));
  const byComp = new Map<string, OralItem[]>();
  for (const it of chosen) byComp.set(it.competence, [...(byComp.get(it.competence) ?? []), it]);
  const out: string[] = [];
  while (out.length < n && [...byComp.values()].some((l) => l.length)) {
    for (const list of byComp.values()) {
      const it = list.shift();
      if (it && out.length < n) out.push(it.id);
    }
  }
  return out;
}

export function startOral(opts: { country: string; persona?: string; mode?: OralMode; itemIds: string[]; seed: number; now: Date; firstQuestion: string }): OralSession {
  const persona = PERSONAS[opts.persona ?? "generic"] ?? PERSONAS.generic!;
  return {
    country: opts.country,
    persona: persona.id,
    mode: opts.mode ?? "exam",
    itemIds: opts.itemIds,
    index: 0,
    phase: "question",
    turns: [
      { role: "examiner", text: persona.greeting },
      { role: "examiner", text: opts.firstQuestion, item_id: opts.itemIds[0] },
    ],
    pendingAnswer: "",
    results: [],
    seed: opts.seed,
    startedAt: opts.now.toISOString(),
  };
}

/**
 * Advance the session with the candidate's answer. Pure: returns a new session.
 * `items` is a lookup of oral items by id.
 */
export function answerOral(s: OralSession, answer: string, items: Map<string, OralItem>): OralSession {
  if (s.phase === "done") return s;
  const persona = PERSONAS[s.persona] ?? PERSONAS.generic!;
  const itemId = s.itemIds[s.index]!;
  const item = items.get(itemId);
  if (!item) throw new Error(`oral item ${itemId} missing`);
  const turns: OralTurn[] = [...s.turns, { role: "candidate", text: answer, item_id: itemId }];
  const combined = s.phase === "probe" ? `${s.pendingAnswer}\n${answer}` : answer;
  const g = gradeOral(item, combined);

  if (s.phase === "question" && g.score < PROBE_BELOW) {
    const fu = item.follow_ups[0];
    const probe = fu ? `${pick(persona.probe, s.seed, s.index)} ${fu}` : pick(persona.probe, s.seed, s.index);
    return { ...s, phase: "probe", pendingAnswer: answer, turns: [...turns, { role: "examiner", text: probe, item_id: itemId }] };
  }

  const result: OralQuestionResult = {
    item_id: itemId,
    score: g.score,
    hit: g.hit,
    missed: g.missed,
    critical: item.critical,
    followUpAsked: s.phase === "probe",
    answer: combined,
  };
  if (s.mode === "coach") {
    turns.push({
      role: "coach",
      text:
        `Covered ${g.hit.length}/${g.hit.length + g.missed.length} key points.` +
        (g.missed.length ? ` Missed: ${g.missed.join("; ")}.` : " Complete answer.") +
        `\nModel answer: ${item.model_answer}`,
      item_id: itemId,
    });
  }
  const nextIndex = s.index + 1;
  const results = [...s.results, result];
  if (nextIndex >= s.itemIds.length) {
    turns.push({ role: "examiner", text: persona.close });
    return { ...s, index: nextIndex, phase: "done", turns, results, pendingAnswer: "" };
  }
  const nextItem = items.get(s.itemIds[nextIndex]!);
  turns.push({ role: "examiner", text: `${pick(persona.next, s.seed, nextIndex)} ${nextItem?.question ?? ""}`.trim(), item_id: s.itemIds[nextIndex] });
  return { ...s, index: nextIndex, phase: "question", turns, results, pendingAnswer: "" };
}

export interface OralVerdict {
  passed: boolean;
  average: number;
  criticalFailures: string[];
  missedByQuestion: { item_id: string; missed: string[] }[];
  summary: string;
}

export function oralVerdict(results: OralQuestionResult[]): OralVerdict {
  const average = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  const criticalFailures = results.filter((r) => r.critical && r.score < ORAL_CRITICAL_MIN).map((r) => r.item_id);
  const passed = results.length > 0 && average >= ORAL_PASS_AVG && criticalFailures.length === 0;
  const pct = Math.round(average * 100);
  const summary = passed
    ? `Pass — you covered ${pct}% of the key points examiners look for.`
    : criticalFailures.length
      ? `Fail — ${criticalFailures.length} safety-critical answer(s) were incomplete. Examiners can fail a candidate on a single unsafe answer.`
      : `Not yet — you covered ${pct}% of key points; ${Math.round(ORAL_PASS_AVG * 100)}% is the app's pass bar.`;
  return {
    passed,
    average,
    criticalFailures,
    missedByQuestion: results.filter((r) => r.missed.length).map((r) => ({ item_id: r.item_id, missed: r.missed })),
    summary,
  };
}
