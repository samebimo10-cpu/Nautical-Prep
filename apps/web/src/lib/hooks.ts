import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import type { Item } from "@cm/content-schema";
import { db, type Profile } from "./db";

export function useProfile(): Profile | null | undefined {
  return useLiveQuery(async () => (await db.profile.get("me")) ?? null, []);
}

export function useItems<T extends Item["type"]>(type?: T): Extract<Item, { type: T }>[] | undefined {
  return useLiveQuery(
    async () => (type ? await db.items.where("type").equals(type).toArray() : await db.items.toArray()) as Extract<Item, { type: T }>[],
    [type],
  );
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function usePracticeItems(): Item[] | undefined {
  return useLiveQuery(async () => (await db.items.toArray()).filter((i) => i.type !== "lesson" && i.status !== "retired"), []);
}
