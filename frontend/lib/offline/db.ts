import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "dreston-offline";
const DB_VERSION = 1;
const OUTBOX_STORE = "outbox";
const CACHE_STORE = "cache";

export interface OutboxItem {
  id: string; // also used as the request's client_id for idempotent replay
  method: "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  description: string; // human-readable summary shown in the sync panel
  createdAt: string;
  status: "pending" | "failed";
  error?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> | null {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: "path" });
        }
      },
    });
  }
  return dbPromise;
}

function dispatchOutboxChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dreston-outbox-changed"));
  }
}

// --- Outbox: pending writes made while offline ------------------------------

export async function addToOutbox(item: OutboxItem) {
  const db = await getDb();
  if (!db) return;
  await db.put(OUTBOX_STORE, item);
  dispatchOutboxChanged();
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const db = await getDb();
  if (!db) return [];
  const items = await db.getAll(OUTBOX_STORE);
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeFromOutbox(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(OUTBOX_STORE, id);
  dispatchOutboxChanged();
}

export async function markOutboxItemFailed(id: string, error: string) {
  const db = await getDb();
  if (!db) return;
  const item = await db.get(OUTBOX_STORE, id);
  if (item) {
    item.status = "failed";
    item.error = error;
    await db.put(OUTBOX_STORE, item);
    dispatchOutboxChanged();
  }
}

export async function resetOutboxItemToPending(id: string) {
  const db = await getDb();
  if (!db) return;
  const item = await db.get(OUTBOX_STORE, id);
  if (item) {
    item.status = "pending";
    item.error = undefined;
    await db.put(OUTBOX_STORE, item);
    dispatchOutboxChanged();
  }
}

export async function outboxCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  return db.count(OUTBOX_STORE);
}

// --- Cache: last-known-good responses for GET requests, used as a fallback -
// when a GET happens while offline.

export async function setCachedGet(path: string, value: unknown) {
  const db = await getDb();
  if (!db) return;
  await db.put(CACHE_STORE, { path, value, cachedAt: Date.now() });
}

export async function getCachedGet<T>(path: string): Promise<T | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const row = await db.get(CACHE_STORE, path);
  return row?.value as T | undefined;
}
