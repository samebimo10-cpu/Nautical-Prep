import { Link } from "react-router-dom";
import { COMPETENCE_LABELS } from "@cm/content-schema";
import { useItems } from "../../lib/hooks";
import { PageHeader } from "../../components/ui";

export function CalcHome() {
  const items = useItems("calc");
  if (!items) return null;
  const groups = new Map<string, typeof items>();
  for (const i of items) groups.set(i.competence, [...(groups.get(i.competence) ?? []), i]);
  return (
    <div>
      <PageHeader title="Calculations" back="/practice" />
      <p className="muted mb-4">
        Every question uses fresh random numbers, and the answer is computed by tested code, never by AI. Reveal the worked solution one step at a time, then
        try again with new numbers until you can do it unaided.
      </p>
      {[...groups.entries()].map(([comp, list]) => (
        <section key={comp} className="mb-4">
          <h2 className="h2 mb-2">{COMPETENCE_LABELS[comp as keyof typeof COMPETENCE_LABELS]}</h2>
          <ul className="grid gap-2">
            {list.map((i) => (
              <li key={i.id}>
                <Link to={`/calc/${i.id}`} className="card flex items-center justify-between !py-3" data-testid={`calc-${i.id}`}>
                  <span className="font-medium capitalize">{i.topic.replace(/-/g, " ")}</span>
                  <span className="text-xs text-slate-600">Level {i.difficulty} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
