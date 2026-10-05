import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { COMPETENCES, COMPETENCE_LABELS } from "@cm/content-schema";
import { confidentErrors, dueQueue } from "@cm/learning";
import { db } from "../../lib/db";
import { Card, PageHeader } from "../../components/ui";

export function PracticeHome() {
  const nav = useNavigate();
  const [competence, setCompetence] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [n, setN] = useState(10);
  const [types, setTypes] = useState("mcq");
  const stats = useLiveQuery(async () => {
    const attempts = await db.attempts.toArray();
    const cards = await db.srs.toArray();
    return {
      errors: confidentErrors(attempts).length,
      due: dueQueue(cards, new Date(), 999).length,
      calc: await db.items.where("type").equals("calc").count(),
      scen: await db.scenarios.count(),
    };
  }, []);
  return (
    <div className="grid gap-4">
      <PageHeader title="Practice" />
      <div className="grid grid-cols-2 gap-2">
        <Link to="/review" className="card !p-3 text-center">
          <div className="text-2xl">🔁</div>
          <div className="font-semibold">Review</div>
          <div className="text-xs text-slate-600">{stats?.due ?? 0} due</div>
        </Link>
        <Link to="/calc" className="card !p-3 text-center">
          <div className="text-2xl">🧮</div>
          <div className="font-semibold">Calculations</div>
          <div className="text-xs text-slate-600">{stats?.calc ?? 0} types</div>
        </Link>
        <Link to="/mock" className="card !p-3 text-center">
          <div className="text-2xl">⏱️</div>
          <div className="font-semibold">Mock exam</div>
          <div className="text-xs text-slate-600">timed, offline</div>
        </Link>
        <Link to="/colregs" className="card !p-3 text-center">
          <div className="text-2xl">🚢</div>
          <div className="font-semibold">COLREGs</div>
          <div className="text-xs text-slate-600">{stats?.scen ?? 0} scenarios</div>
        </Link>
      </div>
      {!!stats?.errors && (
        <Link to="/quiz?mode=errors" className="card flex items-center justify-between bg-red-50 ring-red-200">
          <span>
            <span className="block font-semibold text-red-800">Confident mistakes: {stats.errors}</span>
            <span className="text-xs text-red-700">Questions you got wrong while sure — the most valuable ones to fix.</span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}
      <Card>
        <h2 className="h2 mb-3">Build a quiz</h2>
        <div className="grid gap-3">
          <div>
            <label className="label" htmlFor="q-comp">
              Competence
            </label>
            <select id="q-comp" className="input" value={competence} onChange={(e) => setCompetence(e.target.value)}>
              <option value="">Mixed (interleaved — best for retention)</option>
              {COMPETENCES.map((c) => (
                <option key={c} value={c}>
                  {COMPETENCE_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label" htmlFor="q-diff">
                Difficulty
              </label>
              <select id="q-diff" className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">Any</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="q-n">
                Questions
              </label>
              <select id="q-n" className="input" value={n} onChange={(e) => setN(Number(e.target.value))}>
                {[5, 10, 20, 30, 50].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="q-types">
                Type
              </label>
              <select id="q-types" className="input" value={types} onChange={(e) => setTypes(e.target.value)}>
                <option value="mcq">MCQ</option>
                <option value="written">Written</option>
                <option value="mcq,written">Both</option>
              </select>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() =>
              nav(
                `/quiz?${new URLSearchParams({ ...(competence ? { competence } : { mode: "mixed" }), ...(difficulty ? { difficulty } : {}), n: String(n), types }).toString()}`,
              )
            }
          >
            Start quiz
          </button>
        </div>
      </Card>
    </div>
  );
}
