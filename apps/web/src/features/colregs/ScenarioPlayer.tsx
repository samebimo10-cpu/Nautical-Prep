import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import type { ColregScenario } from "@cm/content-schema";
import { db } from "../../lib/db";
import { recordAttempt } from "../../lib/record";
import { DraftBadge, PageHeader } from "../../components/ui";
import { lightColour, scoreScenario } from "./scoring";

const R = 150; // px radius for the plot
const SCALE_NM = 6;

function Plot({ s }: { s: ColregScenario }) {
  const night = s.time === "night";
  const fog = s.visibility === "restricted";
  return (
    <svg viewBox={`${-R - 10} ${-R - 10} ${2 * R + 20} ${2 * R + 20}`} role="img" aria-label={`Plot: ${s.targets.map((t) => `${t.label} bearing ${t.relative_bearing} degrees relative, ${t.range_nm} miles`).join("; ")}`} className="w-full rounded-2xl">
      <rect x={-R - 10} y={-R - 10} width={2 * R + 20} height={2 * R + 20} fill={night ? "#0b1d33" : "#dbeafe"} />
      {[2, 4, 6].map((nm) => (
        <circle key={nm} r={(nm / SCALE_NM) * R} fill="none" stroke={night ? "#1e3a5f" : "#93c5fd"} strokeDasharray="4 4" />
      ))}
      {[2, 4, 6].map((nm) => (
        <text key={nm} x={4} y={-(nm / SCALE_NM) * R + 12} fontSize="9" fill={night ? "#64748b" : "#1e40af"}>
          {nm} nm
        </text>
      ))}
      {/* own ship: heading up */}
      <g>
        <line x1={0} y1={0} x2={0} y2={-40} stroke={night ? "#94a3b8" : "#1e293b"} strokeWidth={1.5} strokeDasharray="3 3" />
        <path d="M0,-14 L7,10 L-7,10 Z" fill="#13a89e" stroke="#fff" strokeWidth={1.5} />
        <text x={10} y={18} fontSize="10" fill={night ? "#e2e8f0" : "#0f172a"}>
          Own ship
        </text>
      </g>
      {s.targets.map((t, i) => {
        const r = Math.min(1, t.range_nm / SCALE_NM) * R;
        const a = (t.relative_bearing * Math.PI) / 180;
        const x = r * Math.sin(a);
        const y = -r * Math.cos(a);
        return (
          <g key={i} transform={`translate(${x},${y})`}>
            {fog ? (
              <>
                <circle r={6} fill="#f59e0b" opacity={0.9} />
                <line x1={0} y1={0} x2={22 * Math.sin((t.heading_rel * Math.PI) / 180)} y2={-22 * Math.cos((t.heading_rel * Math.PI) / 180)} stroke="#f59e0b" strokeWidth={2} />
              </>
            ) : (
              <g transform={`rotate(${t.heading_rel})`}>
                <path d="M0,-12 L6,9 L-6,9 Z" fill={night ? "#334155" : "#475569"} />
                <line x1={0} y1={-12} x2={0} y2={-30} stroke={night ? "#475569" : "#64748b"} strokeDasharray="2 3" />
              </g>
            )}
            {!fog && night && t.lights.map((l, j) => <circle key={j} cx={14} cy={-10 + j * 7} r={3} fill={lightColour(l)} stroke="#000" strokeWidth={0.5} />)}
            {!fog && !night && t.shapes.length > 0 && (
              <text x={10} y={-6} fontSize="12" fill="#0f172a">
                {t.shapes.map((sh) => (sh.includes("ball") ? "●" : sh.includes("diamond") ? "◆" : sh.includes("cone") ? "▲" : sh.includes("cylinder") ? "▮" : "■")).join("")}
              </text>
            )}
            <text x={10} y={18} fontSize="10" fill={night ? "#e2e8f0" : "#0f172a"}>
              {t.label}
            </text>
          </g>
        );
      })}
      {fog && <rect x={-R - 10} y={-R - 10} width={2 * R + 20} height={2 * R + 20} fill="#cbd5e1" opacity={0.25} />}
    </svg>
  );
}

export function ScenarioPlayer() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const all = useLiveQuery(() => db.scenarios.toArray(), []);
  const [action, setAction] = useState<number | null>(null);
  const [rules, setRules] = useState<string[]>([]);
  const [done, setDone] = useState<number | null>(null);
  const s = all?.find((x) => x.id === id);
  if (!all) return null;
  if (!s) return <p>Scenario not found.</p>;
  const idx = all.indexOf(s);
  const nextId = all[idx + 1]?.id;

  async function submit() {
    if (action === null || !s) return;
    const score = scoreScenario(action === s.correct_action, rules, s.correct_rules);
    setDone(score);
    await recordAttempt({ id: s.id, competence: "COLREG", topic: "scenarios", type: "scenario" }, score, { timeMs: 0, answer: { action, rules }, source: "colregs" });
  }

  return (
    <div>
      <PageHeader title={s.title} back="/colregs" />
      <div className="mb-2 flex items-center gap-2 text-xs">
        <DraftBadge status={s.status} />
        <span>{s.time === "night" ? "🌙 Night" : "☀️ Day"}</span>
        <span>{s.visibility === "restricted" ? "🌫️ Restricted visibility (radar only)" : "Good visibility"}</span>
      </div>
      <Plot s={s} />
      <div className="card mt-3 text-sm">
        <p className="leading-relaxed">{s.situation}</p>
        <p className="mt-2">
          <strong>Own ship:</strong> {s.own_ship}
        </p>
        <ul className="mt-2 grid gap-1">
          {s.targets.map((t, i) => (
            <li key={i}>
              <strong>{t.label}:</strong> {t.vessel}, bearing {t.relative_bearing.toString().padStart(3, "0")}° relative, {t.range_nm} nm
              {s.visibility === "restricted" ? " (radar)" : ""}
              {s.time === "night" && t.lights.length > 0 && s.visibility !== "restricted" && <> · lights: {t.lights.join(", ")}</>}
              {s.time === "day" && t.shapes.length > 0 && <> · shapes: {t.shapes.join(", ")}</>}
              {t.sound && <> · sound: {t.sound}</>}
            </li>
          ))}
        </ul>
      </div>
      <fieldset className="card mt-3" disabled={done !== null}>
        <legend className="font-semibold">1. What action do you take?</legend>
        <div className="mt-2 grid gap-2">
          {s.actions.map((a, i) => (
            <label
              key={i}
              className={`flex min-h-[44px] items-start gap-2 rounded-xl border p-2 text-sm ${
                done !== null && i === s.correct_action ? "border-emerald-500 bg-emerald-50" : done !== null && action === i ? "border-red-500 bg-red-50" : "border-slate-200"
              }`}
            >
              <input type="radio" name="action" className="mt-1 h-5 w-5" checked={action === i} onChange={() => setAction(i)} data-testid={`action-${i}`} />
              {a}
            </label>
          ))}
        </div>
        <legend className="mt-4 font-semibold">2. Which rules apply? (select all)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {s.rule_options.map((r) => {
            const on = rules.includes(r);
            const right = s.correct_rules.includes(r);
            return (
              <button
                type="button"
                key={r}
                aria-pressed={on}
                onClick={() => setRules((x) => (on ? x.filter((y) => y !== r) : [...x, r]))}
                className={`chip min-h-[36px] px-3 text-sm ${done !== null ? (right ? "bg-emerald-200 text-emerald-900" : on ? "bg-red-200 text-red-900" : "bg-slate-100") : on ? "bg-navy-800 text-white" : "bg-slate-100"}`}
              >
                Rule {r}
              </button>
            );
          })}
        </div>
      </fieldset>
      {done === null ? (
        <button className="btn-primary mt-3 w-full" disabled={action === null} onClick={submit} data-testid="scenario-submit">
          Submit decision
        </button>
      ) : (
        <div className="card mt-3" aria-live="polite">
          <p data-testid="scenario-score" className={`text-lg font-bold ${done >= 0.99 ? "text-emerald-700" : done >= 0.6 ? "text-amber-700" : "text-red-700"}`}>
            Score {Math.round(done * 100)}%
          </p>
          <p className="mt-1 text-sm leading-relaxed">{s.explanation}</p>
          <p className="mt-2 text-xs text-slate-600">Rules cited: {s.rules.join("; ")}</p>
          <div className="mt-3 flex gap-2">
            <Link to="/colregs" className="btn-ghost flex-1">
              All scenarios
            </Link>
            {nextId && (
              <button
                className="btn-primary flex-1"
                onClick={() => {
                  setAction(null);
                  setRules([]);
                  setDone(null);
                  nav(`/colregs/${nextId}`);
                }}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
