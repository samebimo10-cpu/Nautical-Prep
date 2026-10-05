import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";
import { useProfile } from "../../lib/hooks";
import { ensureBundle, installedVersion } from "../../lib/bundle";
import { COUNTRY_LIST, ENABLED_WAVES } from "../../lib/countries";
import { supabase } from "../../lib/supabase";
import { backendConfigured } from "../../lib/env";
import { activeBackend, flushQueue } from "../../lib/sync";
import { Banner, Card, PageHeader } from "../../components/ui";

export function ProfilePage() {
  const profile = useProfile();
  const nav = useNavigate();
  const queued = useLiveQuery(() => db.queue.count(), []);
  const [version, setVersion] = useState<string | undefined>();
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) void installedVersion(profile.country).then(setVersion);
    void supabase().then((sb) => sb?.auth.getUser().then(({ data }) => setUser(data.user?.email ?? null)));
  }, [profile]);
  if (!profile) return null;

  async function save(patch: Partial<NonNullable<typeof profile>>) {
    await db.profile.update("me", patch);
  }
  async function changeCountry(code: string) {
    setMsg("Downloading content pack…");
    const ok = await ensureBundle(code);
    if (ok) {
      await save({ country: code });
      setMsg("Country changed.");
    } else setMsg("Connect to the internet to download that country's pack.");
  }
  async function sendOtp() {
    const sb = await supabase();
    if (!sb) return;
    const { error } = await sb.auth.signInWithOtp({ email });
    setMsg(error ? error.message : "Check your email for a 6-digit code.");
    setOtpSent(!error);
  }
  async function verifyOtp() {
    const sb = await supabase();
    if (!sb) return;
    const { data, error } = await sb.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) return setMsg(error.message);
    setUser(data.user?.email ?? null);
    await sb
      .from("profiles")
      .upsert({
        user_id: data.user!.id,
        display_name: profile!.display_name,
        country: profile!.country,
        rank: profile!.rank,
        target_exam_date: profile!.target_exam_date,
        locale: profile!.locale,
      });
    void flushQueue();
  }
  async function google() {
    await (await supabase())?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/profile" } });
  }
  async function exportData() {
    const dump = {
      exported_at: new Date().toISOString(),
      profile: await db.profile.toArray(),
      attempts: await db.attempts.toArray(),
      srs: await db.srs.toArray(),
      mocks: await db.mocks.toArray(),
      orals: await db.orals.toArray(),
      sea_service: await db.sea.toArray(),
      certificates: (await db.certs.toArray()).map(({ file: _f, ...c }) => c),
      reports: await db.reports.toArray(),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `chief-mate-prep-export-${dump.exported_at.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function deleteAccount() {
    if (!confirm("Delete your account and ALL progress on this device (and on the server if signed in)? This cannot be undone.")) return;
    const sb = await supabase();
    if (sb && user) {
      await sb.rpc("delete_my_account");
      await sb.auth.signOut();
    }
    await Promise.all([
      db.profile.clear(),
      db.attempts.clear(),
      db.srs.clear(),
      db.mocks.clear(),
      db.orals.clear(),
      db.sea.clear(),
      db.certs.clear(),
      db.queue.clear(),
      db.reports.clear(),
      db.events.clear(),
      db.reviews.clear(),
    ]);
    nav("/onboarding", { replace: true });
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="Profile & settings" back="/more" />
      {msg && <Banner>{msg}</Banner>}
      <Card>
        <div className="grid gap-3">
          <div>
            <label className="label" htmlFor="p-name">
              Name
            </label>
            <input id="p-name" className="input" defaultValue={profile.display_name} onBlur={(e) => save({ display_name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="p-country">
              Exam country
            </label>
            <select id="p-country" className="input" value={profile.country} onChange={(e) => changeCountry(e.target.value)}>
              {COUNTRY_LIST.map((c) => (
                <option key={c.code} value={c.code} disabled={!ENABLED_WAVES.has(c.wave)}>
                  {c.name}
                  {ENABLED_WAVES.has(c.wave) ? "" : " (coming soon)"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-date">
              Target exam date
            </label>
            <input
              id="p-date"
              type="date"
              className="input"
              defaultValue={profile.target_exam_date ?? ""}
              onChange={(e) => save({ target_exam_date: e.target.value || null })}
            />
          </div>
          <div>
            <label className="label" htmlFor="p-goal">
              Daily goal (questions)
            </label>
            <input
              id="p-goal"
              type="number"
              min={5}
              max={200}
              className="input"
              defaultValue={profile.daily_goal ?? 20}
              onBlur={(e) => save({ daily_goal: Number(e.target.value) })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={!!profile.reviewer_mode} onChange={(e) => save({ reviewer_mode: e.target.checked })} />
            Reviewer mode (subject experts: content review queue)
          </label>
        </div>
      </Card>

      <Card>
        <h2 className="h2">Account & sync</h2>
        <p className="muted">
          Offline pack: {profile.country.toUpperCase()} v{version ?? "—"} · {queued ?? 0} record(s) waiting to sync · backend:{" "}
          {activeBackend()?.name ?? "none (local only)"}
        </p>
        {!backendConfigured() ? (
          <p className="mt-2 text-sm">This build runs in local-only mode. Your progress stays on this device. Use Export to back it up.</p>
        ) : user ? (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm">Signed in as {user}</span>
            <button
              className="btn-ghost"
              onClick={async () => {
                await (await supabase())!.auth.signOut();
                setUser(null);
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-2 grid gap-2">
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            {!otpSent ? (
              <button className="btn-primary" onClick={sendOtp} disabled={!email.includes("@")}>
                Email me a sign-in code
              </button>
            ) : (
              <>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  aria-label="Code"
                />
                <button className="btn-primary" onClick={verifyOtp}>
                  Verify & sync
                </button>
              </>
            )}
            <button className="btn-ghost" onClick={google}>
              Continue with Google
            </button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="h2">Your data</h2>
        <div className="mt-2 grid gap-2">
          <button className="btn-ghost" onClick={exportData}>
            Export my data (JSON)
          </button>
          <button className="btn-danger" onClick={deleteAccount}>
            Delete account & all data
          </button>
        </div>
      </Card>
    </div>
  );
}
