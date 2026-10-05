import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Item, McqItem, WrittenItem } from "@cm/content-schema";
import { confidentErrors, selfMarkScore, type Confidence } from "@cm/learning";
import { db } from "../../lib/db";
import { recordAttempt, trackEvent } from "../../lib/record";
import { aiAvailable, gradeWritten, type GradeResult } from "../../lib/ai";
import { selectQuiz } from "./select";
import { DraftBadge, PageHeader, ProgressBar } from "../../components/ui";
import { ReportButton } from "../../components/ReportButton";

interface Outcome {
  item: Item;
  score: number;
}

export function QuizRun() {
  const [params] = useSearchParams();
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  useEffect(() => {
    void (async () => {
      const items = await db.items.toArray();
      const attempts = await db.attempts.toArray();
      const mode = params.get("mode") ?? undefined;
      setQueue(
        selectQuiz(items, attempts, {
          mode,
          competence: params.get("competence") ?? undefined,
          topic: params.get("topic") ?? undefined,
          difficulty: params.get("difficulty") ? Number(params.get("difficulty")) : undefined,
          n: Number(params.get("n") ?? 10),
          types: (params.get("types") ?? "mcq").split(","),
          ids: params.get("ids")?.split(","),
          errorIds: mode === "errors" ? confidentErrors(attempts) : undefined,
        }),
      );
    })();
  }, [params]);

  if (!queue) return null;
  if (!queue.length)
    return (
      <div>
        <PageHeader title="Quiz" back="/practice" />
        <p className="card">No questions match those filters yet.</p>
      </div>
    );

  if (index >= queue.length) {
    const total = outcomes.reduce((s, o) => s + o.score, 0);
    const pct = Math.round((total / outcomes.length) * 100);
    const missed = outcomes.filter((o) => o.score < 0.6);
    return (
      <div className="grid gap-4">
        <PageHeader title="Quiz complete" back="/practice" />
        <div className="card text-center">
          <div data-testid="quiz-score" className="text-5xl font-black text-navy-800">
            {pct}%
          </div>
          <p className="muted">
            {outcomes.length} questions · {missed.length} to review
          </p>
          <p className="mt-2 text-sm">{pct >= 85 ? "Exam-ready standard on this set." : pct >= 70 ? "Pass level — push for 85%+ for a safety margin." : "Below pass level — missed items are now in your review deck."}</p>
        </div>
        {missed.length > 0 && (
          <Link to={`/quiz?ids=${missed.map((m) => m.item.id).join(",")}`} className="btn-accent">
            Retry the {missed.length} missed
          </Link>
        )}
        <Link to="/" className="btn-ghost">
          Back to home
        </Link>
      </div>
    );
  }

  const item = queue[index]!;
  const next = (score: number) => {
    setOutcomes((o) => [...o, { item, score }]);
    if (index + 1 >= queue.length) void trackEvent("quiz_complete", { n: queue.length });
    setIndex((i) => i + 1);
  };

  return (
    <div>
      <PageHeader title={`Question ${index + 1} of ${queue.length}`} back="/practice" />
      <ProgressBar label="Quiz progress" value={(index / queue.length) * 100} />
      <div className="mt-4">
        {item.type === "mcq" && <McqCard key={item.id} item={item} onDone={next} />}
        {item.type === "written" && <WrittenCard key={item.id} item={item} onDone={next} />}
      </div>
    </div>
  );
}

function ItemMeta({ item }: { item: Item }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span className="chip bg-navy-50 text-navy-700">{item.competence}</span>
      <span className="capitalize">{item.topic.replace(/-/g, " ")}</span>
      <span>· Level {item.difficulty}</span>
      <DraftBadge status={item.status} />
    </div>
  );
}

function Sources({ item }: { item: Item }) {
  if (!item.sources.length) return null;
  return <p className="mt-2 text-xs text-slate-600">📚 {item.sources.map((s) => `${s.label} — ${s.ref}`).join("; ")}</p>;
}

export function McqCard({ item, onDone }: { item: McqItem; onDone: (score: number) => void }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const started = useRef(Date.now());
  const correct = choice === item.correct_index;

  async function submit(confidence: Confidence) {
    setSubmitted(true);
    await recordAttempt(item, correct ? 1 : 0, { timeMs: Date.now() - started.current, confidence, answer: choice, source: "quiz" });
  }

  return (
    <div className="card">
      <ItemMeta item={item} />
      <p className="mb-4 text-lg font-medium" data-testid="stem">
        {item.stem}
      </p>
      <div role="radiogroup" aria-label="Answer options" className="grid gap-2">
        {item.options.map((opt, i) => {
          const state = !submitted ? (choice === i ? "chosen" : "") : i === item.correct_index ? "right" : choice === i ? "wrong" : "";
          return (
            <button
              key={i}
              role="radio"
              aria-checked={choice === i}
              disabled={submitted}
              onClick={() => setChoice(i)}
              data-testid={`option-${i}`}
              className={`min-h-[48px] rounded-xl border px-3 py-2 text-left ${
                state === "chosen" ? "border-sea-500 bg-sea-400/10" : state === "right" ? "border-emerald-500 bg-emerald-50" : state === "wrong" ? "border-red-500 bg-red-50" : "border-slate-200"
              }`}
            >
              <span className="mr-2 font-bold">{"ABCD"[i]}.</span>
              {opt}
            </button>
          );
        })}
      </div>
      {!submitted && choice !== null && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">How sure are you? (calibrates your review schedule)</p>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-primary" onClick={() => submit("sure")} data-testid="conf-sure">
              Sure
            </button>
            <button className="btn-ghost" onClick={() => submit("unsure")} data-testid="conf-unsure">
              Unsure
            </button>
            <button className="btn-ghost" onClick={() => submit("guess")} data-testid="conf-guess">
              Guess
            </button>
          </div>
        </div>
      )}
      {submitted && (
        <div className="mt-4" aria-live="polite">
          <p data-testid="feedback" className={`font-bold ${correct ? "text-emerald-700" : "text-red-700"}`}>
            {correct ? "✓ Correct" : `✗ Incorrect — answer ${"ABCD"[item.correct_index]}`}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{item.explanation}</p>
          <Sources item={item} />
          <div className="mt-3 flex items-center justify-between">
            <ReportButton itemId={item.id} />
            <button className="btn-primary" onClick={() => onDone(correct ? 1 : 0)} data-testid="next">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WrittenCard({ item, onDone }: { item: WrittenItem; onDone: (score: number) => void }) {
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [ticked, setTicked] = useState<boolean[]>(() => item.marking_points.map(() => false));
  const [ai, setAi] = useState<GradeResult | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const started = useRef(Date.now());
  const self = useMemo(() => selfMarkScore(item.marking_points, ticked), [item, ticked]);

  async function save() {
    const score = ai ? ai.score : self;
    await recordAttempt(item, score, { timeMs: Date.now() - started.current, answer, source: "quiz" });
    onDone(score);
  }
  async function askAi() {
    setAiErr(null);
    try {
      setAi(await gradeWritten(item.id, answer));
    } catch (e) {
      setAiErr((e as Error).message);
    }
  }

  return (
    <div className="card">
      <ItemMeta item={item} />
      <p className="mb-3 text-lg font-medium">{item.prompt}</p>
      <label htmlFor="written-answer" className="label">
        Your answer (write it as you would in the exam)
      </label>
      <textarea id="written-answer" className="input min-h-[160px]" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={revealed} />
      {!revealed ? (
        <button className="btn-primary mt-3 w-full" onClick={() => setRevealed(true)} disabled={answer.trim().length < 10}>
          Submit & compare
        </button>
      ) : (
        <div className="mt-4 grid gap-3">
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <h3 className="font-semibold">Model answer</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed">{item.model_answer}</p>
          </div>
          <fieldset>
            <legend className="mb-1 font-semibold">Self-mark: tick each point you covered</legend>
            {item.marking_points.map((p, i) => (
              <label key={i} className="flex items-start gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5"
                  checked={ticked[i]}
                  onChange={(e) => setTicked((t) => t.map((x, j) => (j === i ? e.target.checked : x)))}
                />
                <span>
                  {p.point} <span className="text-slate-500">({p.weight})</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="text-sm font-semibold">Self-mark: {Math.round(self * 100)}%</p>
          {aiAvailable() && !ai && (
            <button className="btn-ghost" onClick={askAi}>
              Grade with AI examiner
            </button>
          )}
          {aiErr && <p className="text-sm text-red-700">AI grading unavailable: {aiErr}</p>}
          {ai && (
            <div className="rounded-xl bg-navy-50 p-3 text-sm">
              <p className="font-semibold">AI grade: {Math.round(ai.score * 100)}%</p>
              <p>{ai.feedback}</p>
              {ai.points_missed.length > 0 && <p className="mt-1">Missed: {ai.points_missed.join("; ")}</p>}
            </div>
          )}
          <Sources item={item} />
          <div className="flex items-center justify-between">
            <ReportButton itemId={item.id} />
            <button className="btn-primary" onClick={save}>
              Save & next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
