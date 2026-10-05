import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { COMPETENCE_LABELS, type Competence, type Item } from "@cm/content-schema";
import { generateCalc } from "@cm/calc";
import { db } from "../../lib/db";
import { PageHeader, ProgressBar } from "../../components/ui";

export function MockResultPage() {
  const { id = "" } = useParams();
  const mock = useLiveQuery(() => db.mocks.get(id), [id]);
  const [items, setItems] = useState<Map<string, Item>>(new Map());
  useEffect(() => {
    if (mock) void db.items.bulkGet(mock.questions.map((q) => q.item_id)).then((l) => setItems(new Map(l.filter(Boolean).map((i) => [i!.id, i!]))));
  }, [mock?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mock?.result) return null;
  const r = mock.result;
  const wrong = mock.questions.filter((q) => !r.perQuestion.find((p) => p.item_id === q.item_id)?.correct);
  return (
    <div className="grid gap-4">
      <PageHeader title="Mock result" back="/mock" />
      <div className={`card text-center ${r.passed ? "ring-emerald-300" : "ring-red-300"}`}>
        <div data-testid="mock-percent" className="text-5xl font-black text-navy-800">
          {Math.round(r.percent)}%
        </div>
        <p data-testid="mock-verdict" className={`text-xl font-bold ${r.passed ? "text-emerald-700" : "text-red-700"}`}>
          {r.passed ? "PASS" : "FAIL"}
        </p>
        <p className="muted">
          {r.correct}/{r.total} correct · pass mark {mock.pass_mark}%{mock.official ? "" : " (practice format)"}
        </p>
        {r.passed && r.percent < 85 && <p className="mt-2 text-sm">You passed. The app's readiness bar is 85% so you have a margin on exam day.</p>}
      </div>
      <div className="card">
        <h2 className="h2 mb-2">By competence</h2>
        <ul className="grid gap-2">
          {Object.entries(r.byCompetence).map(([c, s]) => (
            <li key={c}>
              <div className="flex justify-between text-sm">
                <span>{COMPETENCE_LABELS[c as Competence]}</span>
                <span>
                  {s!.correct}/{s!.total}
                </span>
              </div>
              <ProgressBar label={c} value={(s!.correct / s!.total) * 100} tone={s!.correct / s!.total >= 0.7 ? "sea" : "red"} />
            </li>
          ))}
        </ul>
      </div>
      {wrong.length > 0 && (
        <>
          <Link
            to={`/quiz?ids=${wrong
              .filter((q) => q.kind === "mcq")
              .map((q) => q.item_id)
              .join(",")}`}
            className="btn-accent"
          >
            Re-practise the questions you got wrong
          </Link>
          <div className="card">
            <h2 className="h2 mb-2">Review answers</h2>
            <ol className="grid gap-3">
              {wrong.map((q) => {
                const it = items.get(q.item_id);
                if (!it) return null;
                const given = mock.answers[q.item_id];
                if (it.type === "mcq")
                  return (
                    <li key={q.item_id} className="text-sm">
                      <p className="font-medium">{it.stem}</p>
                      <p className="text-red-700">Your answer: {given != null ? it.options[given] : "—"}</p>
                      <p className="text-emerald-700">Correct: {it.options[it.correct_index]}</p>
                      <p className="text-slate-600">{it.explanation}</p>
                    </li>
                  );
                if (it.type === "calc") {
                  const g = generateCalc(it, q.seed ?? 0);
                  return (
                    <li key={q.item_id} className="text-sm">
                      <p className="whitespace-pre-line font-medium">{g.stem}</p>
                      <p className="text-red-700">Your answer: {given ?? "—"}</p>
                      <p className="text-emerald-700">
                        Correct: {g.answer.toFixed(3)} {it.units}
                      </p>
                      <ol className="list-decimal pl-5 text-slate-600">
                        {g.steps.map((s, i) => (
                          <li key={i} className="whitespace-pre-line">
                            {s.replace(/^\d+\.\s*/, "")}
                          </li>
                        ))}
                      </ol>
                    </li>
                  );
                }
                return null;
              })}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
