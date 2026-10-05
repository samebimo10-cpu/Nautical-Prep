import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { COMPETENCES, COMPETENCE_LABELS } from "@cm/content-schema";
import { confidentErrors, scoreByCompetence, scoreByTopic } from "@cm/learning";
import { db } from "../../lib/db";
import { Card, PageHeader, ProgressBar, Stat } from "../../components/ui";

export function ProgressPage() {
  const attempts = useLiveQuery(() => db.attempts.toArray(), []);
  if (!attempts) return null;
  const now = new Date();
  const comp = scoreByCompetence(attempts, now, 30);
  const topics = Object.values(scoreByTopic(attempts, now, 30))
    .filter((t) => t.attempts >= 2)
    .sort((a, b) => a.avg - b.avg);
  const timeMin = Math.round(attempts.reduce((s, a) => s + (a.time_ms || 0), 0) / 60000);
  const sure = attempts.filter((a) => a.confidence === "sure");
  const calibration = sure.length ? sure.filter((a) => a.score >= 0.6).length / sure.length : null;
  return (
    <div className="grid gap-4">
      <PageHeader title="Progress" back="/" />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Answers" value={attempts.length} sub="all time" />
        <Stat label="Study time" value={`${timeMin}m`} />
        <Stat label="Calibration" value={calibration === null ? "—" : `${Math.round(calibration * 100)}%`} sub="right when 'sure'" />
      </div>
      <Card>
        <h2 className="h2 mb-2">Score by competence (30 days)</h2>
        <ul className="grid gap-2" data-testid="competence-scores">
          {COMPETENCES.map((c) => (
            <li key={c}>
              <div className="flex justify-between text-sm">
                <span>{COMPETENCE_LABELS[c]}</span>
                <span>{comp[c].attempts ? `${Math.round(comp[c].avg * 100)}% · ${comp[c].attempts}` : "—"}</span>
              </div>
              <ProgressBar label={c} value={comp[c].avg * 100} tone={comp[c].avg >= 0.85 ? "sea" : comp[c].avg >= 0.6 ? "amber" : "red"} />
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="h2 mb-2">Weakest topics</h2>
        {topics.length === 0 && <p className="muted">Answer a few more questions to see topic analysis.</p>}
        <ul className="grid gap-1">
          {topics.slice(0, 10).map((t) => (
            <li key={`${t.competence}/${t.topic}`}>
              <Link
                to={`/quiz?competence=${t.competence}&topic=${encodeURIComponent(t.topic)}&n=10`}
                className="flex justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <span className="capitalize">
                  {t.competence} · {t.topic.replace(/-/g, " ")}
                </span>
                <span className={t.avg >= 0.85 ? "text-emerald-700" : t.avg >= 0.6 ? "text-amber-700" : "text-red-700"}>{Math.round(t.avg * 100)}%</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      {confidentErrors(attempts).length > 0 && (
        <Link to="/quiz?mode=errors" className="btn-accent">
          Drill {confidentErrors(attempts).length} confident mistake(s)
        </Link>
      )}
    </div>
  );
}
