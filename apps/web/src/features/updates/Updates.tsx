import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "../../lib/db";
import { PageHeader, Empty } from "../../components/ui";

export function Updates() {
  const updates = useLiveQuery(() => db.updates.orderBy("published_at").reverse().toArray(), []);
  if (!updates) return null;
  return (
    <div>
      <PageHeader title="Regulation updates" back="/more" />
      {!updates.length && <Empty>No updates yet. When a regulation changes, affected questions are flagged here and in your study list.</Empty>}
      <ul className="grid gap-3">
        {updates.map((u) => (
          <li key={u.id} className="card">
            <div className="flex items-center justify-between">
              <h2 className="h2">{u.title}</h2>
              {!u.read && <span className="chip bg-sea-400/20 text-sea-600">new</span>}
            </div>
            <p className="text-xs text-slate-600">{new Date(u.published_at).toLocaleDateString()}</p>
            <p className="mt-2 text-sm">{u.body}</p>
            {u.item_ids.length > 0 && (
              <Link to={`/quiz?ids=${u.item_ids.join(",")}`} onClick={() => db.updates.update(u.id, { read: 1 })} className="btn-ghost mt-2 w-full">
                Revise the {u.item_ids.length} affected item(s)
              </Link>
            )}
            {!u.read && (
              <button className="mt-2 text-xs underline" onClick={() => db.updates.update(u.id, { read: 1 })}>
                Mark as read
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
