"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DashboardSummary } from "@/lib/types";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-plum-800/50">
        {label}
      </p>
      <p className={`font-display text-3xl font-semibold mt-2 ${accent}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardSummary>("/dashboard/summary")
      .then(setSummary)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-plum-800">Good day 👋</h1>
        <p className="text-plum-800/60 mt-1 italic font-display">
          &ldquo;The fear of the Lord is the beginning of wisdom.&rdquo;
        </p>
      </header>

      {error && (
        <div className="card mb-6 border-red-200 bg-red-50 text-red-700 text-sm">
          Couldn&apos;t load today&apos;s summary: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard
          label="Total Students"
          value={summary ? String(summary.total_students) : "…"}
          accent="text-violet-600"
        />
        <StatCard
          label="Present Today"
          value={summary ? String(summary.present_today) : "…"}
          accent="text-violet-600"
        />
        <StatCard
          label="Feeding Money Today"
          value={summary ? `GHS ${summary.feeding_collected_today.toFixed(2)}` : "…"}
          accent="text-gold-500"
        />
        <StatCard
          label="Fees Collected (Current Term)"
          value={summary ? `GHS ${summary.fees_collected_this_term.toFixed(2)}` : "…"}
          accent="text-gold-500"
        />
        <StatCard
          label="Pending Broadcasts"
          value={summary ? String(summary.pending_broadcasts) : "…"}
          accent="text-violet-600"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
        {[
          { href: "/attendance", label: "Mark attendance" },
          { href: "/feeding", label: "Record feeding money" },
          { href: "/fees", label: "Record a fee payment" },
          { href: "/messaging", label: "Send a message home" },
        ].map((a) => (
          <a
            key={a.href}
            href={a.href}
            className="card hover:shadow-lg hover:-translate-y-0.5 transition text-sm font-semibold text-violet-600"
          >
            {a.label} →
          </a>
        ))}
      </div>
    </div>
  );
}
