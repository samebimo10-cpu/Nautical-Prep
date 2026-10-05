import { db, type QueueRow } from "./db";
import { devSyncUrl } from "./env";
import { supabase } from "./supabase";

/** Where queued offline records go when the device is back online. */
export interface SyncBackend {
  name: string;
  push(batch: QueueRow[]): Promise<void>;
}

const TABLE: Record<QueueRow["kind"], string> = {
  attempt: "attempts",
  mock: "mock_exams",
  oral: "oral_sessions",
  report: "content_reports",
  srs: "srs_cards",
  event: "analytics_events",
};

function supabaseBackend(): SyncBackend | null {
  const sb = supabase();
  if (!sb) return null;
  return {
    name: "supabase",
    async push(batch) {
      const { data } = await sb.auth.getUser();
      const uid = data.user?.id;
      if (!uid) throw new Error("not signed in");
      for (const kind of Object.keys(TABLE) as QueueRow["kind"][]) {
        const rows = batch.filter((b) => b.kind === kind).map((b) => ({ ...(b.payload as object), user_id: uid }));
        if (!rows.length) continue;
        const { error } = kind === "srs" ? await sb.from(TABLE[kind]).upsert(rows) : await sb.from(TABLE[kind]).insert(rows);
        if (error) throw error;
      }
    },
  };
}

function httpBackend(url: string): SyncBackend {
  return {
    name: "http",
    async push(batch) {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(batch) });
      if (!res.ok) throw new Error(`sync ${res.status}`);
    },
  };
}

export function activeBackend(): SyncBackend | null {
  const dev = devSyncUrl();
  if (dev) return httpBackend(dev);
  return supabaseBackend();
}

export async function enqueue(kind: QueueRow["kind"], payload: unknown): Promise<void> {
  await db.queue.add({ kind, payload, created_at: new Date().toISOString() });
}

let running = false;

/** Flush the queue in batches. Safe to call often; no-ops offline or without a backend. */
export async function flushQueue(): Promise<{ pushed: number; backend: string | null }> {
  const backend = activeBackend();
  if (!backend || !navigator.onLine || running) return { pushed: 0, backend: backend?.name ?? null };
  running = true;
  let pushed = 0;
  try {
    for (;;) {
      const batch = await db.queue.orderBy("id").limit(100).toArray();
      if (!batch.length) break;
      await backend.push(batch);
      await db.queue.bulkDelete(batch.map((b) => b.id!));
      const attemptIds = batch.filter((b) => b.kind === "attempt").map((b) => (b.payload as { local_id?: number }).local_id).filter((x): x is number => typeof x === "number");
      if (attemptIds.length) await db.attempts.where("id").anyOf(attemptIds).modify({ synced: 1 });
      pushed += batch.length;
    }
  } catch {
    // stay queued; retried on next online event / interval
  } finally {
    running = false;
  }
  return { pushed, backend: backend.name };
}

export function startSync(): () => void {
  const onOnline = () => void flushQueue();
  window.addEventListener("online", onOnline);
  const t = window.setInterval(() => void flushQueue(), 30_000);
  void flushQueue();
  return () => {
    window.removeEventListener("online", onOnline);
    window.clearInterval(t);
  };
}
