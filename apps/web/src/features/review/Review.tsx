import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { keyPointText, type Item } from "@cm/content-schema";
import { dueQueue, review, type SrsCard } from "@cm/learning";
import { db } from "../../lib/db";
import { recordAttempt } from "../../lib/record";
import { PageHeader, ProgressBar } from "../../components/ui";

function Front({ item }: { item: Item }) {
  switch (item.type) {
    case "mcq":
      return (
        <>
          <p className="text-lg font-medium">{item.stem}</p>
          <ol className="mt-2 list-[upper-alpha] pl-6 text-sm text-slate-700">
            {item.options.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ol>
        </>
      );
    case "written":
      return <p className="text-lg font-medium">{item.prompt}</p>;
    case "oral":
      return <p className="text-lg font-medium">🎙️ {item.question}</p>;
    case "calc":
      return <p className="text-lg font-medium">🧮 Recall the method: {item.template.replace(/\{\{.*?\}\}/g, "…")}</p>;
    default:
      return <p className="text-lg font-medium">{item.title}</p>;
  }
}

function Back({ item }: { item: Item }) {
  switch (item.type) {
    case "mcq":
      return (
        <>
          <p className="font-semibold text-emerald-700">
            {"ABCD"[item.correct_index]}. {item.options[item.correct_index]}
          </p>
          <p className="mt-1 text-sm">{item.explanation}</p>
        </>
      );
    case "written":
      return <p className="whitespace-pre-line text-sm">{item.model_answer}</p>;
    case "oral":
      return (
        <ul className="list-disc pl-5 text-sm">
          {item.key_points.map((k, i) => (
            <li key={i}>{keyPointText(k)}</li>
          ))}
        </ul>
      );
    case "calc":
      return <p className="whitespace-pre-line text-sm">{item.worked_solution_template.replace(/\{\{(\w+)(:\d)?\}\}/g, "[$1]")}</p>;
    default:
      return null;
  }
}

const RATINGS = [
  { q: 1, label: "Again", cls: "btn-danger" },
  { q: 3, label: "Hard", cls: "btn-ghost" },
  { q: 4, label: "Good", cls: "btn-primary" },
  { q: 5, label: "Easy", cls: "btn-accent" },
];

export function Review() {
  const [queue, setQueue] = useState<{ card: SrsCard; item: Item }[] | null>(null);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    void (async () => {
      const cards = dueQueue(await db.srs.toArray(), new Date(), 50);
      const items = await db.items.bulkGet(cards.map((c) => c.item_id));
      setQueue(cards.map((card, k) => ({ card, item: items[k]! })).filter((x) => x.item));
    })();
  }, []);

  if (!queue) return null;
  if (i >= queue.length)
    return (
      <div className="grid gap-3">
        <PageHeader title="Review" back="/practice" />
        <div className="card text-center">
          <div className="text-4xl">🎉</div>
          <p className="font-semibold">{queue.length ? `Done — ${queue.length} cards reviewed.` : "Nothing due. Come back tomorrow."}</p>
          <p className="muted">Spaced repetition: each card returns just before you'd forget it.</p>
        </div>
        <Link to="/quiz?mode=mixed&n=10" className="btn-primary">
          Learn new questions
        </Link>
      </div>
    );

  const { card, item } = queue[i]!;
  async function rate(q: number) {
    await db.srs.put(review(card, q, new Date()));
    await recordAttempt(item.type === "lesson" ? { ...item, type: "flashcard" } : { ...item, type: "flashcard" }, q >= 3 ? 1 : 0, {
      timeMs: 0,
      source: "review",
    });
    setShown(false);
    setI((x) => x + 1);
  }
  return (
    <div>
      <PageHeader title={`Review ${i + 1}/${queue.length}`} back="/practice" />
      <ProgressBar label="Review progress" value={(i / queue.length) * 100} />
      <div className="card mt-4">
        <p className="mb-2 text-xs text-slate-600">
          {item.competence} · {item.topic.replace(/-/g, " ")} · interval {card.interval_days}d
        </p>
        <Front item={item} />
        {!shown ? (
          <button className="btn-primary mt-4 w-full" onClick={() => setShown(true)} data-testid="reveal">
            Think of the answer, then reveal
          </button>
        ) : (
          <>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <Back item={item} />
            </div>
            <p className="mt-3 text-sm font-medium">How well did you recall it?</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <button key={r.q} className={`${r.cls} !px-2`} onClick={() => rate(r.q)}>
                  {r.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
