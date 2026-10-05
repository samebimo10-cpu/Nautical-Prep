import { gunzipSync, strFromU8 } from "fflate";
import { OfflineBundle } from "@cm/content-schema";
import { db, getMeta, setMeta } from "./db";

export interface BundleManifestEntry {
  version: string;
  file: string;
  bytes: number;
  items: number;
}
export interface BundleManifest {
  generated_at: string;
  mode: "dev" | "prod";
  countries: Record<string, BundleManifestEntry>;
}

export type Progress = { loaded: number; total: number; phase: "checking" | "downloading" | "installing" | "done" };

export async function fetchManifest(): Promise<BundleManifest> {
  const res = await fetch("/bundles/manifest.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  return (await res.json()) as BundleManifest;
}

export async function installedVersion(country: string): Promise<string | undefined> {
  return getMeta<string>(`bundle:${country}`);
}

async function download(url: string, total: number, onProgress: (p: Progress) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`bundle ${res.status}`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress({ loaded, total, phase: "downloading" });
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/**
 * Ensure the offline content bundle for `country` is installed and current.
 * Offline: keeps whatever is installed. Returns true when content is available.
 */
export async function ensureBundle(country: string, onProgress: (p: Progress) => void = () => {}): Promise<boolean> {
  onProgress({ loaded: 0, total: 0, phase: "checking" });
  const current = await installedVersion(country);
  let manifest: BundleManifest;
  try {
    manifest = await fetchManifest();
  } catch {
    return Boolean(current);
  }
  const entry = manifest.countries[country];
  if (!entry) return Boolean(current);
  if (current === entry.version) {
    onProgress({ loaded: entry.bytes, total: entry.bytes, phase: "done" });
    return true;
  }
  const raw = await download(`/bundles/${entry.file}`, entry.bytes, onProgress);
  onProgress({ loaded: entry.bytes, total: entry.bytes, phase: "installing" });
  const json = JSON.parse(strFromU8(gunzipSync(raw)));
  const bundle = OfflineBundle.parse(json);
  await db.transaction("rw", [db.items, db.scenarios, db.configs, db.meta], async () => {
    await db.items.clear();
    await db.scenarios.clear();
    await db.items.bulkPut(bundle.items);
    await db.scenarios.bulkPut(bundle.scenarios);
    await db.configs.put(bundle.config);
    await setMeta(`bundle:${country}`, bundle.version);
    await setMeta("bundle:active", country);
    await setMeta("booking_md", bundle.booking_md);
    await setMeta("bundle:mode", bundle.mode);
  });
  onProgress({ loaded: entry.bytes, total: entry.bytes, phase: "done" });
  return true;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
