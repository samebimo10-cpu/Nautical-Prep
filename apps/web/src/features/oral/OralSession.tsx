import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import type { OralItem } from "@cm/content-schema";
import { answerOral, oralVerdict, PERSONAS, type OralSession, type OralVerdict } from "@cm/learning";
import { db, type OralRow } from "../../lib/db";
import { recordAttempt, trackEvent } from "../../lib/record";
import { enqueue } from "../../lib/sync";
import { voice } from "../../lib/voice";
import { oralTurn } from "../../lib/ai";
import { useOnline } from "../../lib/hooks";
import { Banner, PageHeader } from "../../components/ui";

async function finalise(row: OralRow, session: OralSession, verdict: OralVerdict, items: Map<string, OralItem>) {
  for (const r of session.results) {
    const it = items.get(r.item_id);
    if (it) await recordAttempt(it, r.score, { timeMs: 0, answer: r.answer, source: "oral" });
  }
  await db.orals.update(row.id, { session, verdict });
  await enqueue("oral", {
    country: row.country,
    transcript: session.turns,
    rubric_scores: session.results.map((r) => ({ item_id: r.item_id, score: r.score, missed: r.missed })),
    verdict: verdict.passed ? "pass" : "fail",
    created_at: row.created_at,
  });
  await trackEvent("oral_complete", { engine: row.engine, average: verdict.average, passed: verdict.passed });
}

export function OralSessionPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const voiceOn = params.get("voice") === "1";
  const online = useOnline();
  const row = useLiveQuery(() => db.orals.get(id), [id]);
  const [items, setItems] = useState<Map<string, OralItem> | null>(null);
  const [text, setText] = useState("");
  const [listening, setListening] = useState<null | { stop: () => Promise<string> }>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const spokenRef = useRef(0);

  useEffect(() => {
    void db.items
      .where("type")
      .equals("oral")
      .toArray()
      .then((l) => setItems(new Map((l as OralItem[]).map((i) => [i.id, i]))));
  }, []);

  // AI engine: start the server session on first load
  useEffect(() => {
    if (!row || row.engine !== "ai" || row.ai_session_id || !online) return;
    void (async () => {
      try {
        const r = await oralTurn({ country: row.country, n: row.session.itemIds.length });
        const persona = PERSONAS[row.session.persona] ?? PERSONAS.generic!;
        await db.orals.update(row.id, {
          ai_session_id: r.session_id,
          session: {
            ...row.session,
            turns: [
              { role: "examiner", text: persona.greeting },
              { role: "examiner", text: r.examiner_text },
            ],
          },
        });
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [row, online]);

  // speak new examiner turns in voice mode
  useEffect(() => {
    if (!row || !voiceOn) return;
    const turns = row.session.turns;
    const fresh = turns.slice(spokenRef.current).filter((t) => t.role === "examiner");
    spokenRef.current = turns.length;
    if (fresh.length) void voice.speak(fresh.map((t) => t.text).join(" "));
  }, [row?.session.turns.length, voiceOn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [row?.session.turns.length]);

  const sendAi = useCallback(
    async (r: OralRow, answer: string) => {
      const res = await oralTurn({ session_id: r.ai_session_id, country: r.country, answer });
      const turns = [...r.session.turns, { role: "candidate" as const, text: answer }, { role: "examiner" as const, text: res.examiner_text }];
      const results = res.grade
        ? [
            ...r.session.results,
            {
              item_id: res.grade.item_id,
              score: res.grade.score,
              hit: res.grade.points_hit,
              missed: res.grade.points_missed,
              critical: items?.get(res.grade.item_id)?.critical ?? false,
              followUpAsked: false,
              answer,
            },
          ]
        : r.session.results;
      const session: OralSession = { ...r.session, turns, results, phase: res.done ? "done" : "question" };
      await db.orals.update(r.id, { session, pending_answer: null });
      if (res.done && items) {
        const v = oralVerdict(results);
        await finalise(r, session, { ...v, summary: res.verdict?.debrief ?? v.summary }, items);
      }
    },
    [items],
  );

  // flush a queued AI answer when back online
  useEffect(() => {
    if (row?.engine === "ai" && row.pending_answer && online && row.ai_session_id)
      void sendAi(row, row.pending_answer).catch((e) => setErr((e as Error).message));
  }, [online, row, sendAi]);

  if (!row || !items) return null;
  const s = row.session;

  async function submit(answer: string) {
    if (!row || !items || !answer.trim()) return;
    setBusy(true);
    setErr(null);
    setText("");
    try {
      if (row.engine === "offline") {
        const next = answerOral(s, answer.trim(), items);
        await db.orals.update(row.id, { session: next });
        if (next.phase === "done") await finalise(row, next, oralVerdict(next.results), items);
      } else if (!navigator.onLine) {
        await db.orals.update(row.id, { pending_answer: answer.trim() });
      } else {
        await sendAi(row, answer.trim());
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleMic() {
    if (listening) {
      const finalText = await listening.stop();
      setListening(null);
      setText(finalText);
      return;
    }
    try {
      voice.stopSpeaking();
      setListening(voice.listen((partial) => setText(partial)));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function addMissedToDeck() {
    if (!row?.verdict) return;
    for (const m of row.verdict.missedByQuestion) {
      const it = items!.get(m.item_id);
      if (it) await recordAttempt(it, 0, { timeMs: 0, source: "oral" });
    }
    setAdded(true);
  }

  const current = s.phase !== "done" ? items.get(s.itemIds[s.index] ?? "") : undefined;

  return (
    <div>
      <PageHeader title={s.phase === "done" ? "Oral debrief" : `Oral · Q${Math.min(s.index + 1, s.itemIds.length)}/${s.itemIds.length}`} back="/oral" />
      {row.pending_answer && <Banner tone="warn">Needs connection. Your answer is queued and will send automatically.</Banner>}
      {err && <Banner tone="warn">{err}</Banner>}
      <ol className="grid gap-2" aria-live="polite" data-testid="transcript">
        {s.turns.map((t, i) => (
          <li
            key={i}
            className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
              t.role === "candidate"
                ? "ml-auto bg-navy-800 text-white"
                : t.role === "coach"
                  ? "bg-emerald-50 ring-1 ring-emerald-200"
                  : "bg-white ring-1 ring-slate-200"
            }`}
          >
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide opacity-70">{t.role}</span>
            {t.text}
          </li>
        ))}
      </ol>
      <div ref={endRef} />

      {s.phase !== "done" ? (
        <div className="sticky bottom-[64px] mt-4 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
          {current?.critical && <p className="mb-1 text-xs font-semibold text-red-700">Safety-critical question: an incomplete answer can fail the oral.</p>}
          <label htmlFor="oral-answer" className="sr-only">
            Your answer
          </label>
          <textarea
            id="oral-answer"
            data-testid="oral-input"
            className="input min-h-[90px]"
            placeholder={listening ? "Listening… speak your answer" : "Answer as the Chief Mate…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            {voice.canListen() && (
              <button className={listening ? "btn-danger" : "btn-ghost"} onClick={toggleMic} aria-pressed={!!listening} data-testid="ptt">
                {listening ? "■ Stop" : "🎙️ Talk"}
              </button>
            )}
            <button className="btn-primary flex-1" disabled={busy || !text.trim()} onClick={() => submit(text)} data-testid="oral-send">
              {s.phase === "probe" ? "Add to answer" : "Answer"}
            </button>
          </div>
          {!voice.canListen() && voiceOn && (
            <p className="mt-1 text-xs text-slate-600">Speech input isn't supported in this browser, so type your answer instead.</p>
          )}
        </div>
      ) : (
        row.verdict && (
          <div className="mt-4 grid gap-3">
            <div className={`card text-center ${row.verdict.passed ? "ring-emerald-300" : "ring-red-300"}`}>
              <p data-testid="oral-verdict" className={`text-2xl font-black ${row.verdict.passed ? "text-emerald-700" : "text-red-700"}`}>
                {row.verdict.passed ? "PASS" : "NOT YET"}
              </p>
              <p className="text-3xl font-bold text-navy-800">{Math.round(row.verdict.average * 100)}%</p>
              <p className="muted">{row.verdict.summary}</p>
            </div>
            <div className="card">
              <h2 className="h2 mb-2">Debrief: missed key points</h2>
              {row.verdict.missedByQuestion.length === 0 && <p>None. Every key point covered.</p>}
              <ol className="grid gap-3" data-testid="debrief">
                {s.results.map((r) => {
                  const it = items.get(r.item_id);
                  if (!it) return null;
                  return (
                    <li key={r.item_id} className="text-sm">
                      <p className="font-semibold">
                        {it.critical && <span className="chip mr-1 bg-red-100 text-red-800">critical</span>}
                        {it.question} — {Math.round(r.score * 100)}%
                      </p>
                      {r.missed.length > 0 && (
                        <ul className="list-disc pl-5 text-red-800">
                          {r.missed.map((m, k) => (
                            <li key={k}>{m}</li>
                          ))}
                        </ul>
                      )}
                      <details className="mt-1">
                        <summary className="cursor-pointer text-sea-600">Model answer</summary>
                        <p className="whitespace-pre-line text-slate-700">{it.model_answer}</p>
                      </details>
                    </li>
                  );
                })}
              </ol>
            </div>
            {row.verdict.missedByQuestion.length > 0 && (
              <button className="btn-accent" onClick={addMissedToDeck} disabled={added}>
                {added ? "Added to your review deck ✓" : "Add missed questions to review deck"}
              </button>
            )}
            <Link to="/oral" className="btn-ghost">
              Back to oral
            </Link>
          </div>
        )
      )}
    </div>
  );
}
