import { Link } from "react-router-dom";
import { useProfile } from "../../lib/hooks";
import { PageHeader } from "../../components/ui";

export function More() {
  const profile = useProfile();
  const links = [
    ["/progress", "📊", "Progress & weak areas"],
    ["/tracker", "🧭", "Sea-time & certificate tracker"],
    ["/booking", "📝", "Exam booking guide"],
    ["/updates", "📢", "Regulation updates"],
    ["/techniques", "🧠", "How this app makes you exam-ready"],
    ["/profile", "👤", "Profile, data & settings"],
    ["/upgrade", "⭐", "Plans"],
    ...(profile?.reviewer_mode ? [["/admin", "🛠️", "Reviewer / admin"]] : []),
  ];
  return (
    <div>
      <PageHeader title="More" />
      <ul className="grid gap-2">
        {links.map(([to, icon, label]) => (
          <li key={to}>
            <Link to={to!} className="card flex items-center gap-3 !py-3">
              <span aria-hidden className="text-xl">
                {icon}
              </span>
              <span className="flex-1 font-medium">{label}</span>
              <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
