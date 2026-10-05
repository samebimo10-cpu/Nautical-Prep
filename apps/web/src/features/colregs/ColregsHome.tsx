import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "../../lib/db";
import { PageHeader } from "../../components/ui";

export function ColregsHome() {
  const data = useLiveQuery(async () => ({ scenarios: await db.scenarios.toArray(), attempts: await db.attempts.where("item_type").equals("scenario").toArray() }), []);
  if (!data) return null;
  const best = new Map<string, number>();
  for (const a of data.attempts) best.set(a.item_id, Math.max(best.get(a.item_id) ?? 0, a.score));
  return (
    <div>
      <PageHeader title="COLREGs scenarios" back="/practice" />
      <p className="muted mb-4">Read the situation from the plot, lights and shapes, then choose your action and the rules that apply. Works offline.</p>
      <ul className="grid gap-2">
        {data.scenarios.map((s, i) => {
          const b = best.get(s.id);
          return (
            <li key={s.id}>
              <Link to={`/colregs/${s.id}`} className="card flex items-center justify-between !py-3" data-testid={`scenario-${s.id}`}>
                <span>
                  <span className="block font-medium">
                    {i + 1}. {s.title}
                  </span>
                  <span className="text-xs text-slate-600">
                    {s.time === "night" ? "🌙 Night" : "☀️ Day"} · {s.visibility === "restricted" ? "🌫️ Restricted visibility" : "Good visibility"}
                  </span>
                </span>
                <span className={`chip ${b === undefined ? "bg-slate-100 text-slate-600" : b >= 0.99 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                  {b === undefined ? "new" : `${Math.round(b * 100)}%`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
