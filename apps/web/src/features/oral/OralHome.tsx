import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { useLiveQuery } from "dexie-react-hooks";
import { COMPETENCES, COMPETENCE_LABELS, keyPointText } from "@cm/content-schema";
import { PERSONAS, selectOralItems, startOral, type OralMode } from "@cm/learning";
import { db } from "../../lib/db";
import { useItems, useOnline, useProfile } from "../../lib/hooks";
import { aiAvailable } from "../../lib/ai";
import { backendConfigured } from "../../lib/env";
import { PERSONA_BY_COUNTRY } from "../../lib/countries";
import { Banner, Card, DraftBadge, PageHeader } from "../../components/ui";

export function OralHome() {
  const nav = useNavigate();
  const profile = useProfile();
  const online = useOnline();
  const items = useItems("oral");
  const history = useLiveQuery(() => db.orals.orderBy("created_at").reverse().limit(10).toArray(), []);
  const [mode, setMode] = useState<OralMode>("exam");
  const [n, setN] = useState(10);
  const [focus, setFocus] = useState("all");
  const [persona, setPersona] = useState<string>("");
  const [engine, setEngine] = useState<"offline" | "ai">("offline");
  const [voiceOn, setVoiceOn] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!items) return [];
    const s = q.toLowerCase();
    return items.filter((i) => (focus === "all" || i.competence === focus) && (!s || i.question.toLowerCase().includes(s) || i.topic.includes(s)));
  }, [items, q, focus]);

  if (!profile || !items) return null;
  const personaId = persona || PERSONA_BY_COUNTRY[profile.country] || "generic";

  async function start() {
    const pool = focus === "all" ? items! : items!.filter((i) => i.competence === focus);
    // prefer previously weak oral items
    const attempts = await db.attempts.where("item_type").equals("oral").toArray();
    const weak = attempts.filter((a) => a.score < 0.6).map((a) => a.item_id);
    const seed = Date.now() % 1e9;
    const ids = selectOralItems(pool, n, seed, weak.slice(-3));
    const id = `oral-${Date.now()}`;
    const first = items!.find((i) => i.id === ids[0])!;
    const session = startOral({ country: profile!.country, persona: personaId, mode, itemIds: ids, seed, now: new Date(), firstQuestion: first.question });
    await db.orals.put({ id, country: profile!.country, engine, session, verdict: null, created_at: new Date().toISOString(), synced: 0 });
    nav(`/oral/session/${id}?voice=${voiceOn ? 1 : 0}`);
  }

  return (
    <div>
      <PageHeader title="Oral examination" />
      <Tabs.Root defaultValue="practice">
        <Tabs.List className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1" aria-label="Oral sections">
          {[
            ["practice", "Examiner"],
            ["bank", `Question bank (${items.length})`],
            ["history", "History"],
          ].map(([v, l]) => (
            <Tabs.Trigger key={v} value={v!} className="rounded-lg px-2 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow">
              {l}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="practice" className="grid gap-4">
          <Card>
            <h2 className="h2">Simulated oral</h2>
            <p className="muted mb-3">
              The examiner asks questions as if you are the Chief Mate. It probes weak answers with follow-ups, and can fail you on a single unsafe answer, just
              like a real examiner.
            </p>
            <div className="grid gap-3">
              <fieldset>
                <legend className="label">Examiner engine</legend>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    aria-pressed={engine === "offline"}
                    className={engine === "offline" ? "btn-primary" : "btn-ghost"}
                    onClick={() => setEngine("offline")}
                  >
                    Offline examiner
                  </button>
                  <button
                    aria-pressed={engine === "ai"}
                    className={engine === "ai" ? "btn-primary" : "btn-ghost"}
                    onClick={() => setEngine("ai")}
                    disabled={!backendConfigured()}
                    title={backendConfigured() ? "" : "AI examiner needs the online backend"}
                  >
                    AI examiner {online ? "" : "(needs connection)"}
                  </button>
                </div>
                {engine === "ai" && !aiAvailable() && (
                  <p className="mt-1 text-xs text-amber-800">Needs a connection. Your answers will queue and send when you're back online.</p>
                )}
                {!backendConfigured() && (
                  <p className="mt-1 text-xs text-slate-600">
                    The offline examiner grades on the device against the key points examiners look for, so it works with no signal.
                  </p>
                )}
              </fieldset>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="oral-mode">
                    Mode
                  </label>
                  <select id="oral-mode" className="input" value={mode} onChange={(e) => setMode(e.target.value as OralMode)}>
                    <option value="exam">Exam (debrief at end)</option>
                    <option value="coach">Coach (feedback each answer)</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="oral-n">
                    Questions
                  </label>
                  <select id="oral-n" className="input" value={n} onChange={(e) => setN(Number(e.target.value))}>
                    {[5, 10, 15, 20].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="oral-focus">
                    Focus
                  </label>
                  <select id="oral-focus" className="input" value={focus} onChange={(e) => setFocus(e.target.value)}>
                    <option value="all">All areas</option>
                    {COMPETENCES.map((c) => (
                      <option key={c} value={c}>
                        {COMPETENCE_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="oral-persona">
                    Examiner style
                  </label>
                  <select id="oral-persona" className="input" value={personaId} onChange={(e) => setPersona(e.target.value)}>
                    {Object.values(PERSONAS).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} />
                Voice mode: the examiner speaks, you answer by push-to-talk
              </label>
              <button className="btn-accent" onClick={start} data-testid="start-oral" disabled={!items.length}>
                Begin oral
              </button>
            </div>
          </Card>
          <Banner>
            Tip: answer out loud even in text mode. Explaining aloud (the Feynman technique) is how you'll be tested. Structure it as: what, why, regulation,
            actions.
          </Banner>
        </Tabs.Content>

        <Tabs.Content value="bank">
          <div className="mb-3 grid gap-2">
            <input className="input" placeholder="Search oral questions…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search oral questions" />
          </div>
          <p className="muted mb-2">{filtered.length} questions. Try to answer before opening the model answer: that's active recall.</p>
          <ul className="grid gap-2">
            {filtered.map((i) => (
              <li key={i.id}>
                <details className="card !py-3">
                  <summary className="cursor-pointer font-medium">
                    {i.critical && <span className="chip mr-1 bg-red-100 text-red-800">safety-critical</span>}
                    {i.question}
                  </summary>
                  <div className="mt-2 text-sm">
                    <div className="mb-1 flex gap-2">
                      <span className="chip bg-navy-50 text-navy-700">{i.competence}</span>
                      <DraftBadge status={i.status} />
                    </div>
                    <p className="whitespace-pre-line leading-relaxed">{i.model_answer}</p>
                    <p className="mt-2 font-semibold">Key points the examiner listens for</p>
                    <ul className="list-disc pl-5">
                      {i.key_points.map((k, j) => (
                        <li key={j}>{keyPointText(k)}</li>
                      ))}
                    </ul>
                    {i.follow_ups.length > 0 && (
                      <>
                        <p className="mt-2 font-semibold">Likely follow-ups</p>
                        <ul className="list-disc pl-5">
                          {i.follow_ups.map((f, j) => (
                            <li key={j}>{f}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {i.sources.length > 0 && <p className="mt-2 text-xs text-slate-600">📚 {i.sources.map((s) => `${s.label} — ${s.ref}`).join("; ")}</p>}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Tabs.Content>

        <Tabs.Content value="history">
          <ul className="grid gap-2">
            {(history ?? []).map((h) => (
              <li key={h.id}>
                <a href={`/oral/session/${h.id}`} className="card flex items-center justify-between !py-3">
                  <span className="text-sm">
                    {new Date(h.created_at).toLocaleString()} · {h.engine}
                  </span>
                  {h.verdict ? (
                    <span className={`chip ${h.verdict.passed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                      {Math.round(h.verdict.average * 100)}%
                    </span>
                  ) : (
                    <span className="chip bg-slate-100">in progress</span>
                  )}
                </a>
              </li>
            ))}
            {!history?.length && <p className="muted">No orals yet.</p>}
          </ul>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
