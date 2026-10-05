import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import { buildMock, mockFormat } from "@cm/learning";
import { db } from "../../lib/db";
import { useProfile } from "../../lib/hooks";
import { entitlementsFor, localTier } from "../../lib/entitlements";
import { Banner, Card, PageHeader } from "../../components/ui";

export function MockHome() {
  const nav = useNavigate();
  const profile = useProfile();
  const data = useLiveQuery(async () => ({
    config: profile ? await db.configs.get(profile.country) : undefined,
    mocks: await db.mocks.orderBy("started_at").reverse().toArray(),
    count: await db.items.count(),
  }), [profile?.country]);
  if (!profile || !data) return null;
  const fmt = mockFormat(data.config);
  const ent = entitlementsFor(localTier());
  const finished = data.mocks.filter((m) => m.result);
  const locked = ent.mocksAllowed !== null && finished.length >= ent.mocksAllowed;
  const inProgress = data.mocks.find((m) => !m.finished_at);

  async function start() {
    const items = await db.items.toArray();
    const id = `mock-${Date.now()}`;
    const questions = buildMock(items, fmt.question_count, Date.now() % 1e9);
    await db.mocks.put({
      id,
      country: profile!.country,
      started_at: new Date().toISOString(),
      finished_at: null,
      duration_minutes: fmt.duration_minutes,
      pass_mark: fmt.pass_mark_percent,
      official: fmt.official,
      questions,
      answers: {},
      flags: [],
      result: null,
      synced: 0,
    });
    nav(`/mock/run/${id}`);
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="Mock exam" back="/practice" />
      {!fmt.official && (
        <Banner tone="warn">
          <strong>Official format not yet confirmed.</strong> This is a practice format: {fmt.question_count} questions, {fmt.duration_minutes} minutes, pass mark{" "}
          {fmt.pass_mark_percent}%.
        </Banner>
      )}
      <Card>
        <h2 className="h2">Exam conditions</h2>
        <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed">
          <li>Timed: the paper submits automatically when time runs out.</li>
          <li>No feedback until you submit, just like the real exam.</li>
          <li>Flag questions and come back to them. Works fully offline.</li>
          <li>Questions are weighted by syllabus area, and calculations use fresh numbers each time.</li>
        </ul>
        {inProgress ? (
          <Link to={`/mock/run/${inProgress.id}`} className="btn-accent mt-4 w-full">
            Resume mock in progress
          </Link>
        ) : locked ? (
          <Link to="/upgrade" className="btn-accent mt-4 w-full">
            Free plan includes 1 mock — upgrade for unlimited
          </Link>
        ) : (
          <button className="btn-primary mt-4 w-full" onClick={start} disabled={data.count === 0} data-testid="start-mock">
            Start mock exam
          </button>
        )}
      </Card>
      {finished.length > 0 && (
        <Card>
          <h2 className="h2 mb-2">History</h2>
          <ul className="divide-y">
            {finished.map((m) => (
              <li key={m.id}>
                <Link to={`/mock/result/${m.id}`} className="flex items-center justify-between py-2">
                  <span className="text-sm">{new Date(m.started_at).toLocaleString()}</span>
                  <span className={`chip ${m.result!.passed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{Math.round(m.result!.percent)}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
