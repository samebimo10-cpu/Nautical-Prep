import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import type { Item } from "@cm/content-schema";
import { generateCalc } from "@cm/calc";
import { gradeMock } from "@cm/learning";
import { db } from "../../lib/db";
import { enqueue } from "../../lib/sync";
import { recordAttempt, trackEvent } from "../../lib/record";
import { optionOrder } from "../../lib/shuffle";

function fmtTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function MockRun() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const mock = useLiveQuery(() => db.mocks.get(id), [id]);
  const [items, setItems] = useState<Map<string, Item> | null>(null);
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!mock) return;
    void db.items.bulkGet(mock.questions.map((q) => q.item_id)).then((list) => setItems(new Map(list.filter(Boolean).map((i) => [i!.id, i!]))));
  }, [mock?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const deadline = mock ? new Date(mock.started_at).getTime() + mock.duration_minutes * 60_000 : 0;
  const remaining = deadline - now;

  const submit = useCallback(async () => {
    if (!mock || !items || mock.finished_at) return;
    const answers = mock.questions.map((q) => ({ item_id: q.item_id, value: mock.answers[q.item_id] ?? null }));
    const result = gradeMock(mock.questions, answers, items, mock.pass_mark);
    const finished_at = new Date().toISOString();
    await db.mocks.update(mock.id, { finished_at, result });
    for (const q of mock.questions) {
      const it = items.get(q.item_id);
      const pq = result.perQuestion.find((p) => p.item_id === q.item_id);
      if (it && pq && (it.type === "mcq" || it.type === "calc"))
        await recordAttempt(it, pq.correct ? 1 : 0, { timeMs: 0, answer: mock.answers[q.item_id], source: "mock" });
    }
    await enqueue("mock", {
      country: mock.country,
      started_at: mock.started_at,
      finished_at,
      score: result.percent,
      passed: result.passed,
      item_ids: mock.questions.map((q) => q.item_id),
    });
    await trackEvent("mock_complete", { percent: result.percent });
    nav(`/mock/result/${mock.id}`, { replace: true });
  }, [mock, items, nav]);

  useEffect(() => {
    if (mock && !mock.finished_at && remaining <= 0 && items) void submit();
  }, [remaining, mock, items, submit]);

  const q = mock?.questions[idx];
  const item = q && items?.get(q.item_id);
  const calc = useMemo(() => (item?.type === "calc" && q ? generateCalc(item, q.seed ?? 0) : null), [item, q]);

  if (!mock || !items) return null;
  if (mock.finished_at) {
    nav(`/mock/result/${mock.id}`, { replace: true });
    return null;
  }
  const answered = Object.values(mock.answers).filter((v) => v !== null && v !== undefined).length;

  async function setAnswer(v: number | null) {
    await db.mocks.update(mock!.id, { answers: { ...mock!.answers, [q!.item_id]: v } });
  }
  async function toggleFlag() {
    const f = mock!.flags.includes(q!.item_id) ? mock!.flags.filter((x) => x !== q!.item_id) : [...mock!.flags, q!.item_id];
    await db.mocks.update(mock!.id, { flags: f });
  }

  return (
    <div>
      <div className="sticky top-[52px] z-20 -mx-4 mb-3 flex items-center justify-between bg-slate-50/95 px-4 py-2 backdrop-blur">
        <span className="font-semibold">
          Q {idx + 1}/{mock.questions.length} · {answered} answered
        </span>
        <span
          data-testid="timer"
          className={`font-mono text-lg font-bold ${remaining < 5 * 60_000 ? "text-red-700" : "text-navy-800"}`}
          role="timer"
          aria-label="Time remaining"
        >
          {fmtTime(remaining)}
        </span>
      </div>
      {item && (
        <div className="card">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
            <span>
              {item.competence} · {item.topic.replace(/-/g, " ")}
            </span>
            <button className={`chip ${mock.flags.includes(item.id) ? "bg-amber-200 text-amber-900" : "bg-slate-100"}`} onClick={toggleFlag} data-testid="flag">
              {mock.flags.includes(item.id) ? "⚑ Flagged" : "⚐ Flag"}
            </button>
          </div>
          {item.type === "mcq" && (
            <>
              <p className="mb-3 text-lg font-medium">{item.stem}</p>
              <div role="radiogroup" aria-label="Options" className="grid gap-2">
                {optionOrder(`${mock.id}:${item.id}`).map((i, pos) => (
                  <button
                    key={i}
                    role="radio"
                    aria-checked={mock.answers[item.id] === i}
                    onClick={() => setAnswer(i)}
                    data-testid={`mock-option-${pos}`}
                    data-correct={i === item.correct_index ? "true" : undefined}
                    className={`min-h-[48px] rounded-xl border px-3 py-2 text-left ${mock.answers[item.id] === i ? "border-sea-500 bg-sea-400/10" : "border-slate-200"}`}
                  >
                    <span className="mr-2 font-bold">{"ABCD"[pos]}.</span>
                    {item.options[i]}
                  </button>
                ))}
              </div>
            </>
          )}
          {item.type === "calc" && calc && (
            <>
              <p className="mb-3 whitespace-pre-line text-lg">{calc.stem}</p>
              <label className="label" htmlFor="mock-calc">
                Answer ({item.units})
              </label>
              <input
                id="mock-calc"
                inputMode="decimal"
                className="input"
                defaultValue={mock.answers[item.id] ?? ""}
                key={item.id}
                onBlur={(e) => setAnswer(e.target.value.trim() ? Number(e.target.value.replace(",", ".")) : null)}
              />
            </>
          )}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button className="btn-ghost flex-1" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          ← Prev
        </button>
        {idx < mock.questions.length - 1 ? (
          <button className="btn-primary flex-1" onClick={() => setIdx((i) => i + 1)} data-testid="mock-next">
            Next →
          </button>
        ) : (
          <button
            className="btn-accent flex-1"
            onClick={() => (confirming ? submit() : setConfirming(true))}
            data-testid="mock-submit"
          >
            {confirming ? `Confirm submit (${answered}/${mock.questions.length} answered)` : "Submit"}
          </button>
        )}
      </div>
      <details className="card mt-4">
        <summary className="cursor-pointer font-semibold">Question map</summary>
        <div className="mt-3 grid grid-cols-8 gap-1.5">
          {mock.questions.map((qq, i) => {
            const a = mock.answers[qq.item_id];
            const flagged = mock.flags.includes(qq.item_id);
            return (
              <button
                key={qq.item_id}
                onClick={() => setIdx(i)}
                aria-label={`Question ${i + 1}${flagged ? " flagged" : ""}${a != null ? " answered" : ""}`}
                className={`h-9 rounded-lg text-xs font-bold ${i === idx ? "ring-2 ring-sea-500" : ""} ${flagged ? "bg-amber-200" : a != null ? "bg-navy-700 text-white" : "bg-slate-100"}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <button className="btn-accent mt-3 w-full" onClick={() => (confirming ? submit() : setConfirming(true))}>
          {confirming ? `Tap again to submit (${answered}/${mock.questions.length} answered)` : "Submit paper"}
        </button>
      </details>
    </div>
  );
}
