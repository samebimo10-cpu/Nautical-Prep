import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { generateCalc, gradeCalc } from "@cm/calc";
import { db } from "../../lib/db";
import { recordAttempt } from "../../lib/record";
import { DraftBadge, PageHeader } from "../../components/ui";
import { ReportButton } from "../../components/ReportButton";

export function CalcPractice() {
  const { id = "" } = useParams();
  const item = useLiveQuery(() => db.items.get(id), [id]);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [answer, setAnswer] = useState("");
  const [stepsShown, setStepsShown] = useState(0);
  const [result, setResult] = useState<null | boolean>(null);
  const [count, setCount] = useState({ done: 0, right: 0 });
  const started = useRef(Date.now());
  const g = useMemo(() => (item && item.type === "calc" ? generateCalc(item, seed) : null), [item, seed]);

  if (item === undefined) return null;
  if (!item || item.type !== "calc" || !g) return <p>Not found.</p>;

  async function check() {
    if (!item || item.type !== "calc" || !g) return;
    const ok = gradeCalc(g.answer, Number(answer.replace(",", ".")), g.tolerance);
    // using hints reduces credit: full marks only when solved unaided
    const score = ok ? (stepsShown === 0 ? 1 : stepsShown < g.steps.length ? 0.7 : 0.4) : 0;
    setResult(ok);
    setStepsShown(g.steps.length);
    setCount((c) => ({ done: c.done + 1, right: c.right + (ok ? 1 : 0) }));
    await recordAttempt(item, score, { timeMs: Date.now() - started.current, answer: Number(answer), source: "calc" });
  }
  function next() {
    setSeed(Math.floor(Math.random() * 1e9));
    setAnswer("");
    setStepsShown(0);
    setResult(null);
    started.current = Date.now();
  }

  return (
    <div>
      <PageHeader
        title={item.topic.replace(/-/g, " ")}
        back="/calc"
        right={
          <span className="chip bg-navy-50 text-navy-700">
            {count.right}/{count.done}
          </span>
        }
      />
      <div className="card">
        <div className="mb-2 flex items-center gap-2">
          <DraftBadge status={item.status} />
          <span className="text-xs text-slate-600">
            Tolerance ±{item.tolerance} {item.units}
          </span>
        </div>
        <p className="whitespace-pre-line text-lg leading-relaxed" data-testid="calc-stem">
          {g.stem}
        </p>
        <label className="label mt-4" htmlFor="calc-answer">
          Your answer ({item.units})
        </label>
        <div className="flex gap-2">
          <input
            id="calc-answer"
            inputMode="decimal"
            className="input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={result !== null}
            data-testid="calc-input"
          />
          {result === null ? (
            <button className="btn-primary" onClick={check} disabled={!answer.trim()} data-testid="calc-check">
              Check
            </button>
          ) : (
            <button className="btn-accent" onClick={next} data-testid="calc-next">
              New numbers
            </button>
          )}
        </div>
        {result !== null && (
          <p data-testid="calc-result" className={`mt-3 font-bold ${result ? "text-emerald-700" : "text-red-700"}`}>
            {result ? "✓ Correct" : "✗ Not within tolerance"} — answer {g.answer.toFixed(item.units === "°" ? 1 : 3)} {item.units}
          </p>
        )}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Worked solution</h2>
            {result === null && stepsShown < g.steps.length && (
              <button className="btn-ghost !min-h-[36px] text-sm" onClick={() => setStepsShown((s) => s + 1)} data-testid="calc-step">
                Reveal step {stepsShown + 1}
              </button>
            )}
          </div>
          <ol className="mt-2 grid gap-2">
            {g.steps.slice(0, stepsShown).map((s, i) => (
              <li key={i} className="whitespace-pre-line rounded-lg bg-slate-50 p-2 text-sm ring-1 ring-slate-200" data-testid="calc-step-text">
                {s}
              </li>
            ))}
          </ol>
          {stepsShown === 0 && result === null && <p className="muted mt-1">Try it first. Revealing steps reduces the credit you earn.</p>}
        </div>
        <div className="mt-3">
          <ReportButton itemId={item.id} />
        </div>
      </div>
    </div>
  );
}
