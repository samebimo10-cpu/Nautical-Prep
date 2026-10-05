import { NavLink, Outlet } from "react-router-dom";
import { useOnline } from "../lib/hooks";
import { t } from "../i18n";

const tabs = [
  { to: "/", label: t("nav.home"), icon: "⚓", end: true },
  { to: "/study", label: t("nav.study"), icon: "📘" },
  { to: "/practice", label: t("nav.practice"), icon: "🎯" },
  { to: "/oral", label: t("nav.oral"), icon: "🎙️" },
  { to: "/more", label: t("nav.more"), icon: "☰" },
];

export function Layout() {
  const online = useOnline();
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="sticky top-0 z-30 bg-navy-800 px-4 py-3 text-white shadow">
        <div className="flex items-center justify-between">
          <span className="font-bold tracking-wide">{t("app.name")}</span>
          <span
            data-testid="net-status"
            className={`chip ${online ? "bg-sea-500/20 text-sea-400" : "bg-amber-400/20 text-amber-200"}`}
            aria-live="polite"
          >
            {online ? "Online" : "Offline"}
          </span>
        </div>
      </header>
      {!online && (
        <div role="status" className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
          {t("offline.banner")}
        </div>
      )}
      <main id="main" className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex min-h-[56px] flex-col items-center justify-center text-xs font-medium ${isActive ? "text-sea-600" : "text-slate-600"}`
                }
              >
                <span aria-hidden className="text-lg leading-none">
                  {tab.icon}
                </span>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
