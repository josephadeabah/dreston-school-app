"use client";

import { useState } from "react";
import { useSync } from "@/lib/offline/SyncProvider";

export default function SyncStatusBanner() {
  const { isOnline, pendingCount, syncing, syncNow, pendingItems, refreshPendingItems, retryItem, discardItem } =
    useSync();
  const [showPanel, setShowPanel] = useState(false);

  if (isOnline && pendingCount === 0) return null;

  async function togglePanel() {
    if (!showPanel) await refreshPendingItems();
    setShowPanel((v) => !v);
  }

  return (
    <div className="mb-4">
      <div
        className={`rounded-xl px-4 py-2.5 text-sm flex items-center justify-between flex-wrap gap-2 ${
          isOnline ? "bg-gold-400/20 text-gold-500" : "bg-plum-800/10 text-plum-800"
        }`}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>{isOnline ? "🔄" : "📴"}</span>
          {!isOnline && "You're offline — new records are being saved on this device."}
          {isOnline && pendingCount > 0 && `${pendingCount} record${pendingCount === 1 ? "" : "s"} waiting to sync.`}
        </span>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <button onClick={togglePanel} className="text-xs font-semibold underline">
              {showPanel ? "Hide details" : "View details"}
            </button>
          )}
          {isOnline && pendingCount > 0 && (
            <button
              onClick={() => syncNow()}
              disabled={syncing}
              className="text-xs font-semibold bg-white/60 rounded-full px-3 py-1 hover:bg-white"
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          )}
        </div>
      </div>

      {showPanel && (
        <div className="card mt-2 p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-blush-100 text-plum-800/70 text-left">
              <tr>
                <th className="px-4 py-2 font-semibold">What</th>
                <th className="px-4 py-2 font-semibold">Saved at</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold w-32"></th>
              </tr>
            </thead>
            <tbody>
              {pendingItems.map((item) => (
                <tr key={item.id} className="border-t border-blush-100">
                  <td className="px-4 py-2">{item.description}</td>
                  <td className="px-4 py-2 text-plum-800/60 text-xs">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {item.status === "failed" ? (
                      <span className="pill bg-red-100 text-red-700" title={item.error}>
                        Failed
                      </span>
                    ) : (
                      <span className="pill bg-gold-400/30 text-gold-500">Waiting to sync</span>
                    )}
                  </td>
                  <td className="px-4 py-2 space-x-3">
                    {item.status === "failed" && (
                      <button
                        onClick={() => retryItem(item)}
                        className="text-xs text-violet-600 hover:underline"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => discardItem(item)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Discard
                    </button>
                  </td>
                </tr>
              ))}
              {pendingItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-plum-800/40">
                    Nothing pending.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
