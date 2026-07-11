"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { Student } from "@/lib/types";

export default function FeedingPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<"cash" | "momo" | "bank" | "card">("cash");
  const [saving, setSaving] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ total_collected: number; number_of_students: number } | null>(
    null
  );

  async function loadSummary() {
    const s = await api.get<{ total_collected: number; number_of_students: number }>(
      `/feeding/summary/daily?on_date=${date}`
    );
    setSummary(s);
  }

  useEffect(() => {
    api
      .get<Student[]>(`/students${search ? `?search=${encodeURIComponent(search)}` : ""}`)
      .then(setStudents)
      .catch((e) => toast.error(e.message));
  }, [search]);

  useEffect(() => {
    loadSummary().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function handleRecord(studentId: string) {
    const amountStr = amounts[studentId];
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount first.");
      return;
    }
    setSaving(studentId);
    try {
      await api.post("/feeding", {
        student_id: studentId,
        date,
        amount,
        payment_method: method,
      });
      toast.success("Feeding money recorded.");
      setAmounts({ ...amounts, [studentId]: "" });
      loadSummary();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not record this collection.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-plum-800">Morning Feeding Money</h1>
        <p className="text-plum-800/60 text-sm mt-1">
          Record what each child brings for breakfast/lunch.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-plum-800/50">
            Collected today
          </p>
          <p className="font-display text-3xl font-semibold text-gold-500 mt-2">
            GHS {summary ? summary.total_collected.toFixed(2) : "0.00"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-plum-800/50">
            Students who paid
          </p>
          <p className="font-display text-3xl font-semibold text-violet-600 mt-2">
            {summary ? summary.number_of_students : 0}
          </p>
        </div>
      </div>

      <div className="card mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Payment method</label>
          <select
            className="input"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          >
            <option value="cash">Cash</option>
            <option value="momo">Mobile Money</option>
            <option value="bank">Bank</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search student</label>
          <input
            className="input"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-blush-100 text-plum-800/70 text-left">
            <tr>
              <th className="px-5 py-3 font-semibold">Student</th>
              <th className="px-5 py-3 font-semibold">Amount (GHS)</th>
              <th className="px-5 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t border-blush-100">
                <td className="px-5 py-3 font-medium">{s.full_name}</td>
                <td className="px-5 py-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input w-32"
                    placeholder="0.00"
                    value={amounts[s.id] ?? ""}
                    onChange={(e) => setAmounts({ ...amounts, [s.id]: e.target.value })}
                  />
                </td>
                <td className="px-5 py-3">
                  <button
                    className="btn-secondary"
                    disabled={saving === s.id}
                    onClick={() => handleRecord(s.id)}
                  >
                    {saving === s.id ? "Saving…" : "Record"}
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-plum-800/50">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
