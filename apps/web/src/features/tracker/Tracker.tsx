import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { certificateStatus, eligibilityProgress, seaTimeTotals } from "@cm/learning";
import { db } from "../../lib/db";
import { useProfile } from "../../lib/hooks";
import { Banner, Card, PageHeader, ProgressBar } from "../../components/ui";

const CAPACITIES = ["Second Officer", "Third Officer", "Chief Mate", "OOW (other)", "Cadet"];
const COURSES = ["Medical Care", "Advanced Fire Fighting", "ECDIS", "GMDSS GOC", "Proficiency in Survival Craft", "Ship Security Officer", "Bridge Resource Management", "Leadership & Managerial Skills", "High Voltage / other"];

export function Tracker() {
  const profile = useProfile();
  const data = useLiveQuery(async () => ({
    sea: await db.sea.orderBy("from_date").toArray(),
    certs: await db.certs.toArray(),
    config: profile ? await db.configs.get(profile.country) : undefined,
  }), [profile?.country]);
  const [form, setForm] = useState({ vessel: "", vessel_type: "Bulk carrier", grt: "", from_date: "", to_date: "", capacity: CAPACITIES[0]! });
  const [cert, setCert] = useState({ course: COURSES[0]!, issued_at: "", expires_at: "" });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return null;
  const totals = seaTimeTotals(data.sea);
  const qualifying = (totals.byCapacity["Second Officer"]?.months ?? 0) + (totals.byCapacity["Chief Mate"]?.months ?? 0) + (totals.byCapacity["OOW (other)"]?.months ?? 0);
  const elig = eligibilityProgress(qualifying, data.config?.eligibility.sea_time_months ?? null);
  const now = new Date();

  async function addSea() {
    setErr(null);
    if (!form.vessel || !form.from_date || !form.to_date) return setErr("Vessel and both dates are required.");
    if (form.to_date < form.from_date) return setErr("Sign-off must be after sign-on.");
    await db.sea.add({ ...form, grt: form.grt ? Number(form.grt) : undefined });
    setForm({ ...form, vessel: "", from_date: "", to_date: "" });
  }
  async function addCert() {
    await db.certs.add({ course: cert.course, issued_at: cert.issued_at || null, expires_at: cert.expires_at || null, file_name: file?.name ?? null, file });
    setCert({ ...cert, issued_at: "", expires_at: "" });
    setFile(null);
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="Tracker" back="/more" />
      <Card>
        <h2 className="h2">Sea service</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="text-xs text-slate-600">Total</div>
            <div data-testid="sea-total" className="text-2xl font-bold">
              {totals.totalDays} days
            </div>
            <div className="text-xs">{totals.totalMonths.toFixed(1)} months</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="text-xs text-slate-600">Qualifying (OOW-level)</div>
            <div className="text-2xl font-bold">{qualifying.toFixed(1)} mo</div>
          </div>
        </div>
        <div className="mt-3">
          {elig.confirmed ? (
            <>
              <ProgressBar label="Eligibility" value={elig.percent!} />
              <p className="mt-1 text-sm">{elig.remainingMonths! > 0 ? `${elig.remainingMonths!.toFixed(1)} months to go` : "Sea-time requirement met"}</p>
            </>
          ) : (
            <Banner tone="warn">Required sea time for {data.config?.name ?? "your country"}: not confirmed yet. Check with your administration.</Banner>
          )}
        </div>
        <ul className="mt-2 divide-y text-sm">
          {Object.entries(totals.byCapacity).map(([c, v]) => (
            <li key={c} className="flex justify-between py-1">
              <span>{c}</span>
              <span>
                {v.days} d ({v.months.toFixed(1)} mo)
              </span>
            </li>
          ))}
        </ul>
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold text-sea-600">Add a voyage</summary>
          <div className="mt-2 grid gap-2">
            <input aria-label="Vessel name" className="input" placeholder="Vessel name" value={form.vessel} onChange={(e) => setForm({ ...form, vessel: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Vessel type" className="input" placeholder="Type" value={form.vessel_type} onChange={(e) => setForm({ ...form, vessel_type: e.target.value })} />
              <input aria-label="GRT" className="input" placeholder="GT" inputMode="numeric" value={form.grt} onChange={(e) => setForm({ ...form, grt: e.target.value })} />
              <label className="text-xs">
                Sign-on
                <input type="date" className="input" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} data-testid="sea-from" />
              </label>
              <label className="text-xs">
                Sign-off
                <input type="date" className="input" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} data-testid="sea-to" />
              </label>
            </div>
            <select aria-label="Capacity" className="input" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })}>
              {CAPACITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {err && <p className="text-sm text-red-700">{err}</p>}
            <button className="btn-primary" onClick={addSea} data-testid="sea-add">
              Add voyage
            </button>
          </div>
        </details>
        <ul className="mt-3 grid gap-1 text-sm">
          {data.sea.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1">
              <span>
                {s.vessel} · {s.capacity} · {s.from_date} → {s.to_date}
              </span>
              <button aria-label={`Delete ${s.vessel}`} className="text-red-700" onClick={() => db.sea.delete(s.id!)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="h2">Certificates</h2>
        <ul className="mt-2 grid gap-2">
          {data.certs.map((c) => {
            const st = certificateStatus(c.expires_at, now);
            return (
              <li key={c.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                <span>
                  <span className="block font-medium">{c.course}</span>
                  <span className="text-xs text-slate-600">
                    {c.expires_at ? `Expires ${c.expires_at}` : "No expiry"} {c.file_name ? `· 📎 ${c.file_name}` : ""}
                  </span>
                </span>
                <span
                  className={`chip ${st.status === "expired" ? "bg-red-100 text-red-800" : st.status === "expiring" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}
                >
                  {st.status === "expired" ? "Expired" : st.status === "expiring" ? `${st.daysLeft} days left` : "Valid"}
                </span>
              </li>
            );
          })}
        </ul>
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold text-sea-600">Add certificate</summary>
          <div className="mt-2 grid gap-2">
            <select aria-label="Course" className="input" value={cert.course} onChange={(e) => setCert({ ...cert, course: e.target.value })}>
              {COURSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                Issued
                <input type="date" className="input" value={cert.issued_at} onChange={(e) => setCert({ ...cert, issued_at: e.target.value })} />
              </label>
              <label className="text-xs">
                Expires
                <input type="date" className="input" value={cert.expires_at} onChange={(e) => setCert({ ...cert, expires_at: e.target.value })} />
              </label>
            </div>
            <label className="text-xs">
              Scan / photo (stored on this device; uploads when you're signed in)
              <input type="file" accept="image/*,application/pdf" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <button className="btn-primary" onClick={addCert}>
              Save certificate
            </button>
          </div>
        </details>
      </Card>
    </div>
  );
}
