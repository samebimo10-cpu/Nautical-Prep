import { useLiveQuery } from "dexie-react-hooks";
import { Link, useParams } from "react-router-dom";
import { db } from "../../lib/db";
import { DraftBadge, PageHeader } from "../../components/ui";
import { Markdown } from "../../components/Markdown";
import { ReportButton } from "../../components/ReportButton";

export function LessonPage() {
  const { id = "" } = useParams();
  const item = useLiveQuery(() => db.items.get(id), [id]);
  if (item === undefined) return null;
  if (!item || item.type !== "lesson") return <p>Lesson not found.</p>;
  return (
    <article>
      <PageHeader title={item.title} back={`/study/${item.competence}`} />
      <div className="mb-3 flex items-center gap-2">
        <DraftBadge status={item.status} />
        <ReportButton itemId={item.id} />
      </div>
      <div className="card">
        <Markdown>{item.body_md}</Markdown>
        {item.sources.length > 0 && (
          <p className="mt-4 border-t pt-2 text-xs text-slate-600">Sources: {item.sources.map((s) => `${s.label} (${s.ref})`).join("; ")}</p>
        )}
      </div>
      <div className="mt-4 grid gap-2">
        {item.related_item_ids.length > 0 && (
          <Link to={`/quiz?ids=${item.related_item_ids.join(",")}`} className="btn-accent">
            Test yourself now (retrieval practice)
          </Link>
        )}
        <Link to={`/quiz?competence=${item.competence}&topic=${encodeURIComponent(item.topic)}&n=10`} className="btn-ghost">
          Quiz this topic
        </Link>
      </div>
    </article>
  );
}
