import { supabase } from "@/lib/supabaseClient";
import {
  listOutbox,
  removeFromOutbox,
  markOutboxItemFailed,
  resetOutboxItemToPending,
  type OutboxItem,
} from "./db";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface FlushResult {
  succeeded: number;
  failed: number;
  stoppedEarly: boolean; // true if we hit another network failure mid-flush
}

async function getAuthToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

/**
 * Replays every queued outbox item against the real backend, in the order
 * they were created. Items that the server rejects for a real reason (a
 * validation error, not a network problem) are marked "failed" and kept
 * around for staff to review rather than retried forever. If the network
 * drops again partway through, we stop and leave the rest queued for next
 * time — we never lose an item.
 */
export async function flushOutbox(): Promise<FlushResult> {
  const items = await listOutbox();
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    if (item.status === "failed") continue; // needs manual attention, skip on auto-sync

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}${item.path}`, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (!res.ok) {
        let detail = `Server rejected this (status ${res.status}).`;
        try {
          const errBody = await res.json();
          detail = errBody.detail || detail;
        } catch {
          /* ignore parse errors */
        }
        await markOutboxItemFailed(item.id, detail);
        failed++;
        continue;
      }

      await removeFromOutbox(item.id);
      succeeded++;
    } catch {
      // Network failed again mid-sync — stop here, everything else stays
      // queued for the next time we come online.
      return { succeeded, failed, stoppedEarly: true };
    }
  }

  return { succeeded, failed, stoppedEarly: false };
}

/** Retry a single failed item by clearing its failed status so the next
 * flush attempt picks it up again. */
export async function retryOutboxItem(item: OutboxItem) {
  await resetOutboxItemToPending(item.id);
}

export { listOutbox, removeFromOutbox };
