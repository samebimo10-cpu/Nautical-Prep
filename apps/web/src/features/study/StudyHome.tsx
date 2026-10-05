import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { COMPETENCES, COMPETENCE_LABELS } from "@cm/content-schema";
import { db } from "../../lib/db";
import { PageHeader, ProgressBar } from "../../components/ui";

export function StudyHome() {
  const data = useLiveQuery(async () => ({ items: await db.items.toArray(), attempts: await db.attempts.toArray() }), []);
  if (!data) return null;
  const latest = new Map<string, number>();
  for (const a of data.attempts.sort((x, y) => x.created_at.localeCompare(y.created_at))) latest.set(a.item_id, a.score);
  return (
    <div>
      <PageHeader title="Study" />
      <p className="muted mb-4">Lessons first, then test yourself. Progress bars show how much you've covered and your accuracy.</p>
      <ul className="grid gap-3">
        {COMPETENCES.map((c) => {
          const items = data.items.filter((i) => i.competence === c);
          if (!items.length) return null;
          const practice = items.filter((i) => i.type !== "lesson");
          const lessons = items.length - practice.length;
          const seen = practice.filter((i) => latest.has(i.id));
          const acc = seen.length ? seen.reduce((s, i) => s + latest.get(i.id)!, 0) / seen.length : 0;
          const cov = practice.length ? seen.length / practice.length : 0;
          return (
            <li key={c}>
              <Link to={`/study/${c}`} className="card block hover:ring-sea-400" data-testid={`competence-${c}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-navy-800">{COMPETENCE_LABELS[c]}</span>
                  <span className="chip bg-navy-50 text-navy-700">{c}</span>
                </div>
                <p className="mb-2 text-xs text-slate-600">
                  {practice.length} questions · {lessons} lesson{lessons === 1 ? "" : "s"}
                </p>
                <div className="grid gap-1 text-xs">
                  <span>Covered {Math.round(cov * 100)}%</span>
                  <ProgressBar label={`${c} coverage`} value={cov * 100} tone="navy" />
                  <span>Accuracy {Math.round(acc * 100)}%</span>
                  <ProgressBar label={`${c} accuracy`} value={acc * 100} tone={acc >= 0.85 ? "sea" : acc >= 0.6 ? "amber" : "red"} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
