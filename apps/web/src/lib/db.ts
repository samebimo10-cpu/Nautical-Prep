import Dexie, { type Table } from "dexie";
import type { ColregScenario, CountryConfig, Item } from "@cm/content-schema";
import type { Attempt, OralSession, OralVerdict, SrsCard, SeaServiceEntry, MockQuestion, MockResult } from "@cm/learning";

export interface Profile {
  id: "me";
  display_name: string;
  country: string;
  rank: string;
  target_exam_date: string | null;
  locale: string;
  created_at: string;
  reviewer_mode?: boolean;
  daily_goal?: number;
  voice_rate?: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export interface StoredAttempt extends Attempt {
  id?: number;
  synced: 0 | 1;
}

export interface MockRow {
  id: string;
  country: string;
  started_at: string;
  finished_at: string | null;
  duration_minutes: number;
  pass_mark: number;
  official: boolean;
  questions: MockQuestion[];
  answers: Record<string, number | null>;
  flags: string[];
  result: MockResult | null;
  synced: 0 | 1;
}

export interface OralRow {
  id: string;
  country: string;
  engine: "offline" | "ai";
  session: OralSession;
  ai_session_id?: string;
  pending_answer?: string | null;
  verdict: OralVerdict | null;
  created_at: string;
  synced: 0 | 1;
}

export interface CertRow {
  id?: number;
  course: string;
  issued_at: string | null;
  expires_at: string | null;
  file_name: string | null;
  file?: Blob | null;
}

export interface SeaRow extends SeaServiceEntry {
  id?: number;
}

export interface QueueRow {
  id?: number;
  kind: "attempt" | "mock" | "oral" | "report" | "srs" | "event";
  payload: unknown;
  created_at: string;
}

export interface ReportRow {
  id?: number;
  item_id: string;
  message: string;
  created_at: string;
  status: "open" | "sent";
}

export interface UpdateRow {
  id: string;
  title: string;
  body: string;
  item_ids: string[];
  published_at: string;
  read: 0 | 1;
}

export interface ReviewDecision {
  item_id: string;
  decision: "reviewed" | "retired" | "changes";
  reviewer: string;
  note: string;
  decided_at: string;
}

export class AppDB extends Dexie {
  items!: Table<Item, string>;
  scenarios!: Table<ColregScenario, string>;
  configs!: Table<CountryConfig, string>;
  meta!: Table<MetaRow, string>;
  profile!: Table<Profile, string>;
  attempts!: Table<StoredAttempt, number>;
  srs!: Table<SrsCard, string>;
  mocks!: Table<MockRow, string>;
  orals!: Table<OralRow, string>;
  sea!: Table<SeaRow, number>;
  certs!: Table<CertRow, number>;
  queue!: Table<QueueRow, number>;
  reports!: Table<ReportRow, number>;
  updates!: Table<UpdateRow, string>;
  reviews!: Table<ReviewDecision, string>;
  events!: Table<{ id?: number; name: string; at: string; props?: Record<string, unknown> }, number>;

  constructor() {
    super("chief-mate-prep");
    this.version(1).stores({
      items: "id, type, competence, topic, [competence+type]",
      scenarios: "id",
      configs: "code",
      meta: "key",
      profile: "id",
      attempts: "++id, item_id, competence, created_at, synced, item_type",
      srs: "item_id, due_at",
      mocks: "id, started_at, synced",
      orals: "id, created_at, synced",
      sea: "++id, from_date",
      certs: "++id, expires_at",
      queue: "++id, kind",
      reports: "++id, item_id, status",
      updates: "id, published_at",
      reviews: "item_id",
      events: "++id, name, at",
    });
  }
}

export const db = new AppDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
