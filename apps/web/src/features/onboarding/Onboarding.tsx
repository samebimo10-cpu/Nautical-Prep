import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../lib/db";
import { ensureBundle, fetchManifest, formatBytes, type Progress } from "../../lib/bundle";
import { COUNTRY_LIST, ENABLED_WAVES } from "../../lib/countries";
import { trackEvent } from "../../lib/record";
import { ProgressBar } from "../../components/ui";

const RANKS = ["Second Officer", "Third Officer", "Chief Mate (revalidating)", "Cadet / other"];

export function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [rank, setRank] = useState(RANKS[0]!);
  const [date, setDate] = useState("");
  const [size, setSize] = useState<number | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function chooseCountry(code: string) {
    setCountry(code);
    try {
      const m = await fetchManifest();
      setSize(m.countries[code]?.bytes ?? null);
    } catch {
      setSize(null);
    }
  }

  async function finish() {
    if (!country) return;
    setError(null);
    try {
      const ok = await ensureBundle(country, setProgress);
      if (!ok) throw new Error("Content could not be downloaded. Connect once to install the offline pack.");
      await db.profile.put({
        id: "me",
        display_name: name.trim() || "Officer",
        country,
        rank,
        target_exam_date: date || null,
        locale: "en",
        created_at: new Date().toISOString(),
        daily_goal: 20,
      });
      await trackEvent("onboarding_complete", { country, rank });
      nav("/", { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-navy-800 px-5 py-8 text-white">
      <h1 className="text-3xl font-bold">Chief Mate Prep</h1>
      <p className="mt-1 text-navy-100">STCW II/2 · offline-first · oral examiner</p>
      <ol className="mt-4 flex gap-2" aria-label="Steps">
        {[0, 1, 2].map((i) => (
          <li key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-sea-400" : "bg-white/20"}`} />
        ))}
      </ol>

      <div className="mt-6 rounded-2xl bg-white p-5 text-slate-900">
        {step === 0 && (
          <div>
            <h2 className="h2 mb-3">Where will you sit the exam?</h2>
            <div role="radiogroup" aria-label="Country" className="grid gap-2">
              {COUNTRY_LIST.map((c) => {
                const enabled = ENABLED_WAVES.has(c.wave);
                return (
                  <button
                    key={c.code}
                    role="radio"
                    aria-checked={country === c.code}
                    disabled={!enabled}
                    onClick={() => chooseCountry(c.code)}
                    className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-3 text-left ${
                      country === c.code ? "border-sea-500 bg-sea-400/10" : "border-slate-200"
                    } ${enabled ? "" : "opacity-60"}`}
                  >
                    <span aria-hidden className="text-2xl">
                      {c.flag}
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{c.name}</span>
                      <span className="text-xs text-slate-600">{c.authority}</span>
                    </span>
                    {!enabled && <span className="chip bg-slate-100 text-slate-700">Coming soon</span>}
                  </button>
                );
              })}
            </div>
            <button className="btn-primary mt-4 w-full" disabled={!country} onClick={() => setStep(1)}>
              Continue
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-3">
            <h2 className="h2">About you</h2>
            <div>
              <label className="label" htmlFor="name">
                Your name
              </label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ade" />
            </div>
            <div>
              <label className="label" htmlFor="rank">
                Current rank
              </label>
              <select id="rank" className="input" value={rank} onChange={(e) => setRank(e.target.value)}>
                {RANKS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="date">
                Target exam date (optional)
              </label>
              <input id="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setStep(0)}>
                Back
              </button>
              <button className="btn-primary flex-1" onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3">
            <h2 className="h2">Download your offline pack</h2>
            <p className="muted">
              All questions, lessons, calculations, mock exams, COLREGs scenarios and the offline oral examiner are stored on your phone so you can study at
              sea with no signal.
            </p>
            <p className="text-sm font-medium">Download size: {size ? formatBytes(size) : "—"}</p>
            {progress && (
              <div aria-live="polite">
                <ProgressBar label="Download progress" value={progress.total ? (progress.loaded / progress.total) * 100 : 5} />
                <p className="mt-1 text-xs text-slate-600">
                  {progress.phase === "downloading" ? `${formatBytes(progress.loaded)} of ${formatBytes(progress.total)}` : progress.phase}
                </p>
              </div>
            )}
            {error && <p className="text-sm font-semibold text-signal-red">{error}</p>}
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn-accent flex-1" onClick={finish} disabled={!!progress && progress.phase !== "done"}>
                Download & start
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
