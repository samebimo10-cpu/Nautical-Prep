import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import * as Tabs from "@radix-ui/react-tabs";
import { keyPointText, type Item } from "@cm/content-schema";
import { db, type ReviewDecision } from "../../lib/db";
import { useProfile } from "../../lib/hooks";
import { supabase } from "../../lib/supabase";
import { Banner, Card, PageHeader } from "../../components/ui";

function ItemBody({ item }: { item: Item }) {
  switch (item.type) {
    case "mcq":
      return (
        <div className="text-sm">
          <p className="font-medium">{item.stem}</p>
          <ol className="list-[upper-alpha] pl-6">
            {item.options.map((o, i) => (
              <li key={i} className={i === item.correct_index ? "font-semibold text-emerald-700" : ""}>
                {o}
              </li>
            ))}
          </ol>
          <p className="mt-1 text-slate-700">{item.explanation}</p>
        </div>
      );
    case "oral":
      return (
        <div className="text-sm">
          <p className="font-medium">{item.question}</p>
          <p className="mt-1 whitespace-pre-line">{item.model_answer}</p>
          <ul className="list-disc pl-5">
            {item.key_points.map((k, i) => (
              <li key={i}>{keyPointText(k)}</li>
            ))}
          </ul>
        </div>
      );
    case "written":
      return (
        <div className="text-sm">
          <p className="font-medium">{item.prompt}</p>
          <p className="mt-1 whitespace-pre-line">{item.model_answer}</p>
        </div>
      );
    case "calc":
      return (
        <div className="text-sm">
          <p className="font-medium">{item.template}</p>
          <p className="text-xs">calc_fn: {item.calc_fn}</p>
        </div>
      );
    default:
      return <p className="text-sm">{item.title}</p>;
  }
}

export function Admin() {
  const profile = useProfile();
  const [filter, setFilter] = useState("all");
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [upd, setUpd] = useState({ title: "", body: "", ids: "" });
  const data = useLiveQuery(
    async () => ({
      items: await db.items.toArray(),
      reviews: await db.reviews.toArray(),
      reports: await db.reports.toArray(),
      events: await db.events.toArray(),
    }),
    [],
  );
  const queue = useMemo(() => {
    if (!data) return [];
    const decided = new Set(data.reviews.map((r) => r.item_id));
    return data.items.filter((i) => i.status === "draft" && !decided.has(i.id) && (filter === "all" || i.competence === filter));
  }, [data, filter]);

  if (!profile?.reviewer_mode) return <Banner tone="warn">Reviewer mode is off. Turn it on in Profile (subject experts only).</Banner>;
  if (!data) return null;

  async function decide(item: Item, decision: ReviewDecision["decision"]) {
    const d: ReviewDecision = { item_id: item.id, decision, reviewer: reviewer || "unknown", note, decided_at: new Date().toISOString().slice(0, 10) };
    await db.reviews.put(d);
    setNote("");
    const sb = await supabase();
    if (sb && decision !== "changes") {
      await sb.from("items").update({ status: decision, needs_review: false, reviewer: d.reviewer, last_reviewed: d.decided_at }).eq("id", item.id);
    }
  }
  function exportDecisions() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data!.reviews, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `review-decisions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }
  async function postUpdate() {
    const ids = upd.ids.split(/[\s,]+/).filter(Boolean);
    const row = { id: `upd-${Date.now()}`, title: upd.title, body: upd.body, item_ids: ids, published_at: new Date().toISOString(), read: 0 as const };
    await db.updates.put(row);
    await (await supabase())?.from("regulation_updates").insert({ title: row.title, body: row.body, item_ids: ids });
    setUpd({ title: "", body: "", ids: "" });
  }
  const item = queue[0];
  const counts = data.events.reduce<Record<string, number>>((m, e) => ({ ...m, [e.name]: (m[e.name] ?? 0) + 1 }), {});

  return (
    <div>
      <PageHeader title="Reviewer / admin" back="/more" />
      <Tabs.Root defaultValue="queue">
        <Tabs.List className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-slate-200 p-1 text-sm">
          {["queue", "reports", "updates", "stats"].map((v) => (
            <Tabs.Trigger key={v} value={v} className="rounded-lg py-2 font-semibold capitalize data-[state=active]:bg-white">
              {v}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="queue" className="grid gap-3">
          <Banner>
            {queue.length} draft items awaiting review · {data.reviews.length} decisions made. Export decisions and run{" "}
            <code>pnpm content:apply-reviews file.json</code> to write them to the content repo (the next offline bundle then includes approved items).
          </Banner>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Reviewer name & credentials"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              aria-label="Reviewer"
            />
            <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
              <option value="all">All competences</option>
              {["NAV", "STAB", "CARGO", "COLREG", "LAW", "MGMT", "LOCAL"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          {item ? (
            <Card>
              <p className="mb-1 text-xs text-slate-600">
                {item.id} · {item.type} · {item.competence}/{item.topic} · countries {item.countries.join(",")}
              </p>
              <ItemBody item={item} />
              <p className="mt-2 text-xs text-slate-600">Sources: {item.sources.map((s) => `${s.label} ${s.ref}`).join("; ") || "none"}</p>
              <textarea
                className="input mt-2"
                placeholder="Note (required for changes)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="Note"
              />
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button className="btn-accent" disabled={!reviewer} onClick={() => decide(item, "reviewed")} data-testid="approve">
                  Approve
                </button>
                <button className="btn-ghost" disabled={!reviewer || !note} onClick={() => decide(item, "changes")}>
                  Needs changes
                </button>
                <button className="btn-danger" disabled={!reviewer} onClick={() => decide(item, "retired")}>
                  Retire
                </button>
              </div>
            </Card>
          ) : (
            <p className="card">Queue empty.</p>
          )}
          <button className="btn-ghost" onClick={exportDecisions} disabled={!data.reviews.length}>
            Export {data.reviews.length} decision(s)
          </button>
        </Tabs.Content>
        <Tabs.Content value="reports">
          <ul className="grid gap-2">
            {data.reports.map((r) => (
              <li key={r.id} className="card text-sm">
                <p className="font-semibold">{r.item_id}</p>
                <p>{r.message}</p>
                <p className="text-xs text-slate-600">{r.created_at}</p>
              </li>
            ))}
            {!data.reports.length && <p className="muted">No reports on this device.</p>}
          </ul>
        </Tabs.Content>
        <Tabs.Content value="updates" className="card grid gap-2">
          <input
            className="input"
            placeholder="Title (e.g. MARPOL Annex VI amendment in force)"
            value={upd.title}
            onChange={(e) => setUpd({ ...upd, title: e.target.value })}
            aria-label="Title"
          />
          <textarea
            className="input"
            placeholder="What changed"
            value={upd.body}
            onChange={(e) => setUpd({ ...upd, body: e.target.value })}
            aria-label="Body"
          />
          <input
            className="input"
            placeholder="Affected item IDs (comma separated)"
            value={upd.ids}
            onChange={(e) => setUpd({ ...upd, ids: e.target.value })}
            aria-label="Item IDs"
          />
          <button className="btn-primary" disabled={!upd.title} onClick={postUpdate} data-testid="post-update">
            Post update
          </button>
        </Tabs.Content>
        <Tabs.Content value="stats" className="card">
          <ul className="text-sm">
            {Object.entries(counts).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b py-1">
                <span>{k}</span>
                <span>{v}</span>
              </li>
            ))}
            {!Object.keys(counts).length && <li className="muted">No events yet.</li>}
          </ul>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
