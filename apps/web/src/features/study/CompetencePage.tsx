import { useLiveQuery } from "dexie-react-hooks";
import { Link, useParams } from "react-router-dom";
import { COMPETENCE_LABELS, type Competence } from "@cm/content-schema";
import { db } from "../../lib/db";
import { PageHeader } from "../../components/ui";

export function CompetencePage() {
  const { competence = "NAV" } = useParams();
  const data = useLiveQuery(
    async () => ({
      items: await db.items.where("competence").equals(competence).toArray(),
      attempts: await db.attempts.where("competence").equals(competence).toArray(),
    }),
    [competence],
  );
  if (!data) return null;
  const lessons = data.items.filter((i) => i.type === "lesson");
  const topics = new Map<string, { total: number; types: Set<string> }>();
  for (const i of data.items) {
    if (i.type === "lesson") continue;
    const t = topics.get(i.topic) ?? { total: 0, types: new Set() };
    t.total++;
    t.types.add(i.type);
    topics.set(i.topic, t);
  }
  const score = (topic: string) => {
    const list = data.attempts.filter((a) => a.topic === topic);
    return list.length ? Math.round((list.reduce((s, a) => s + a.score, 0) / list.length) * 100) : null;
  };
  return (
    <div>
      <PageHeader title={COMPETENCE_LABELS[competence as Competence] ?? competence} back="/study" />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Link to={`/quiz?competence=${competence}&n=15`} className="btn-primary">
          Quiz all
        </Link>
        <Link to={`/quiz?competence=${competence}&n=10&types=written`} className="btn-ghost">
          Written practice
        </Link>
      </div>
      {lessons.length > 0 && (
        <section className="mb-5">
          <h2 className="h2 mb-2">Lessons</h2>
          <ul className="grid gap-2">
            {lessons.map((l) => (
              <li key={l.id}>
                <Link to={`/lesson/${l.id}`} className="card flex items-center justify-between !py-3">
                  <span className="font-medium">📖 {l.type === "lesson" ? l.title : l.id}</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h2 className="h2 mb-2">Topics</h2>
      <ul className="grid gap-2">
        {[...topics.entries()].sort().map(([topic, t]) => {
          const s = score(topic);
          return (
            <li key={topic}>
              <Link to={`/quiz?competence=${competence}&topic=${encodeURIComponent(topic)}&n=10`} className="card flex items-center justify-between !py-3">
                <span>
                  <span className="block font-medium capitalize">{topic.replace(/-/g, " ")}</span>
                  <span className="text-xs text-slate-600">
                    {t.total} items · {[...t.types].join(", ")}
                  </span>
                </span>
                <span
                  className={`chip ${s === null ? "bg-slate-100 text-slate-600" : s >= 85 ? "bg-emerald-100 text-emerald-800" : s >= 60 ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800"}`}
                >
                  {s === null ? "new" : `${s}%`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
