// Used by the standalone single-file build, which has no service worker.
export function registerSW(_opts?: unknown): () => void {
  return () => {};
}
