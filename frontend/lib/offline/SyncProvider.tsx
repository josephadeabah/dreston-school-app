"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { outboxCount, listOutbox, type OutboxItem } from "./db";
import { flushOutbox, retryOutboxItem, removeFromOutbox } from "./sync";

interface SyncContextValue {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  syncNow: () => Promise<void>;
  pendingItems: OutboxItem[];
  refreshPendingItems: () => Promise<void>;
  retryItem: (item: OutboxItem) => Promise<void>;
  discardItem: (item: OutboxItem) => Promise<void>;
}

const SyncContext = createContext<SyncContextValue>({
  isOnline: true,
  pendingCount: 0,
  syncing: false,
  syncNow: async () => {},
  pendingItems: [],
  refreshPendingItems: async () => {},
  retryItem: async () => {},
  discardItem: async () => {},
});

export function useSync() {
  return useContext(SyncContext);
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    setPendingCount(await outboxCount());
  }, []);

  const refreshPendingItems = useCallback(async () => {
    const items = await listOutbox();
    setPendingItems(items);
    setPendingCount(items.length);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const { succeeded, failed, stoppedEarly } = await flushOutbox();
      if (succeeded > 0) {
        toast.success(`Synced ${succeeded} offline record${succeeded === 1 ? "" : "s"}.`);
      }
      if (failed > 0) {
        toast.error(
          `${failed} offline record${failed === 1 ? "" : "s"} couldn't be synced — check the sync panel.`
        );
      }
      if (stoppedEarly && succeeded === 0 && failed === 0) {
        // Connection dropped again before anything went through — stay quiet,
        // it'll retry automatically next time we're online.
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      refreshCount();
      refreshPendingItems();
    }
  }, [refreshCount, refreshPendingItems]);

  const retryItemFn = useCallback(
    async (item: OutboxItem) => {
      await retryOutboxItem(item);
      await refreshPendingItems();
      syncNow();
    },
    [refreshPendingItems, syncNow]
  );

  const discardItemFn = useCallback(
    async (item: OutboxItem) => {
      await removeFromOutbox(item.id);
      await refreshPendingItems();
    },
    [refreshPendingItems]
  );

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshCount();

    function handleOnline() {
      setIsOnline(true);
      toast.success("Back online — syncing your offline work…");
      syncNow();
    }
    function handleOffline() {
      setIsOnline(false);
      toast("You're offline. Your work will be saved on this device and synced automatically once you're back online.", {
        icon: "📴",
        duration: 5000,
      });
    }
    function handleOutboxChanged() {
      refreshCount();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("dreston-outbox-changed", handleOutboxChanged);

    // A light periodic nudge in case the browser's online/offline events
    // don't fire reliably (this happens on some mobile browsers).
    const interval = setInterval(() => {
      if (navigator.onLine) syncNow();
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("dreston-outbox-changed", handleOutboxChanged);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        pendingCount,
        syncing,
        syncNow,
        pendingItems,
        refreshPendingItems,
        retryItem: retryItemFn,
        discardItem: discardItemFn,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
