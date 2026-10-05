import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { COMPETENCE_LABELS } from "@cm/content-schema";
import { dailyPlan, dueQueue, readiness, streakDays, studyNext } from "@cm/learning";
import { db } from "../../lib/db";
import { useProfile } from "../../lib/hooks";
import { countryName } from "../../lib/countries";
import { Banner, Card, ProgressBar, Stat } from "../../components/ui";

export function Dashboard() {
  const profile = useProfile();
  const data = useLiveQuery(async () => {
    const [items, attempts, cards, mocks, orals, updates, mode] = await Promise.all([
      db.items.toArray(),
      db.attempts.toArray(),
      db.srs.toArray(),
      db.mocks.toArray(),
      db.orals.toArray(),
      db.updates.where("read").equals(0).count(),
      db.meta.get("bundle:mode"),
    ]);
    return { items, attempts, cards, mocks, orals, updates, mode: mode?.value as string | undefined };
  }, []);
  if (!profile || !data) return null;
  const now = new Date();
  const practice = data.items.filter((i) => i.type !== "lesson");
  const seen = new Set(data.attempts.map((a) => a.item_id));
  const due = dueQueue(data.cards, now, 500).length;
  const plan = dailyPlan({ targetDate: profile.target_exam_date, unseenItems: practice.filter((i) => !seen.has(i.id)).length, reviewsDue: due, now });
  const r = readiness({
    items: data.items,
    attempts: data.attempts,
    mocks: data.mocks.filter((m) => m.result).map((m) => ({ percent: m.result!.percent, finished_at: m.finished_at! })),
    orals: data.orals
      .filter((o) => o.verdict)
      .map((o) => ({ average: o.verdict!.average, criticalFailures: o.verdict!.criticalFailures.length, created_at: o.created_at })),
    now,
  });
  const recs = studyNext(
    data.attempts,
    practice.map((i) => ({ competence: i.competence, topic: i.topic })),
    now,
    3,
  );
  const today = now.toISOString().slice(0, 10);
  const doneToday = data.attempts.filter((a) => a.created_at.startsWith(today)).length;
  const goal = profile.daily_goal ?? 20;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="h1">
          Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, {profile.display_name}
        </h1>
        <p className="muted">
          {countryName(profile.country)} · Chief Mate CoC · {profile.rank}
        </p>
      </div>
      {data.mode !== "prod" && (
        <Banner tone="warn">Practice content is original and awaiting maritime-expert review. Always confirm against current regulations.</Banner>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="h2">Exam readiness</h2>
          <span data-testid="readiness-score" className={`text-3xl font-black ${r.ready ? "text-emerald-600" : "text-navy-800"}`}>
            {r.score}%
          </span>
        </div>
        <p className="muted mb-3">
          {r.ready
            ? "You have cleared every bar — above the level needed to pass. Keep reviewing daily."
            : "The app's bars are set above the real pass marks so you walk in with margin."}
        </p>
        <ul className="grid gap-2">
          {r.checks.map((c) => (
            <li key={c.id}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {c.met ? "✅" : "⬜"} {c.label}
                </span>
                <span className="text-slate-600">{Math.round(c.value * 100)}%</span>
              </div>
              <ProgressBar label={c.label} value={c.value * 100} tone={c.met ? "sea" : "navy"} />
              <p className="mt-0.5 text-xs text-slate-500">{c.detail}</p>
            </li>
          ))}
        </ul>
        <Link to="/progress" className="mt-3 inline-block text-sm font-semibold text-sea-600">
          Detailed analytics →
        </Link>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Streak" value={`${streakDays(data.attempts, now)}d`} />
        <Stat label="Today" value={`${doneToday}/${goal}`} sub="questions" />
        <Stat label="Reviews" value={due} sub="due now" />
      </div>

      <Card>
        <h2 className="h2">Today's plan</h2>
        <p className="muted mb-3">{plan.message}</p>
        <div className="grid gap-2">
          {due > 0 && (
            <Link to="/review" className="btn-accent w-full">
              Review {due} due card{due === 1 ? "" : "s"} (spaced repetition)
            </Link>
          )}
          <Link to={`/quiz?mode=mixed&n=${Math.min(20, Math.max(10, plan.newItemsPerDay))}`} className="btn-primary w-full">
            Mixed practice · {Math.min(20, Math.max(10, plan.newItemsPerDay))} questions
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/mock" className="btn-ghost">
              Mock exam
            </Link>
            <Link to="/oral" className="btn-ghost">
              Oral practice
            </Link>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="h2 mb-2">Study next</h2>
        <ul className="grid gap-2">
          {recs.map((rec) => (
            <li key={`${rec.competence}/${rec.topic}`}>
              <Link
                to={`/quiz?competence=${rec.competence}&topic=${encodeURIComponent(rec.topic ?? "")}&n=10`}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <span>
                  <span className="block font-semibold">{rec.topic?.replace(/-/g, " ")}</span>
                  <span className="text-xs text-slate-600">
                    {COMPETENCE_LABELS[rec.competence]} · {rec.reason}
                  </span>
                </span>
                <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {data.updates > 0 && (
        <Link to="/updates" className="card flex items-center justify-between">
          <span className="font-semibold">📢 {data.updates} regulation update(s)</span>
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
