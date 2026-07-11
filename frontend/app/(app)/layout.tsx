"use client";

import Sidebar from "@/components/Sidebar";
import SyncStatusBanner from "@/components/SyncStatusBanner";
import { useAuth } from "@/lib/useAuth";
import { SyncProvider } from "@/lib/offline/SyncProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, signOut } = useAuth(true);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blush-50">
        <p className="text-plum-800/60">Loading…</p>
      </div>
    );
  }

  return (
    <SyncProvider>
      <div className="flex min-h-screen bg-blush-50">
        <Sidebar profile={profile} onSignOut={signOut} />
        <main className="flex-1 p-8 max-w-6xl">
          <SyncStatusBanner />
          {children}
        </main>
      </div>
    </SyncProvider>
  );
}
