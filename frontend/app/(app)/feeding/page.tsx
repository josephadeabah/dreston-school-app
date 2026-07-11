"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { FeedingCollection, Student } from "@/lib/types";

export default function FeedingPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<"cash" | "momo" | "bank" | "card">("cash");
  const [saving, setSaving] = useState<string | null>(null);
  // What each student has already had recorded for the selected date —
  // this is what makes "money added for a student" visible in the table.
  const [collectedByStudent, setCollectedByStudent] = useState<Record<string, FeedingCollection>>(
    {}
  );
  const [loadingCollections, setLoadingCollections] = useState(false);

  async function loadCollectionsForDate() {
    setLoadingCollections(true);
    try {
      const rows = await api.get<FeedingCollection[]>(`/feeding?on_date=${date}`);
      const byStudent: Record<string, FeedingCollection> = {};
      rows.forEach((r) => (byStudent[r.student_id] = r));
      setCollectedByStudent(byStudent);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not load today's collections.");
    } finally {
      setLoadingCollections(false);
    }
  }

  useEffect(() => {
    api
      .get<Student[]>(`/students${search ? `?search=${encodeURIComponent(search)}` : ""}`)
      .then(setStudents)
      .catch((e) => toast.error(e.message));
  }, [search]);

  useEffect(() => {
    loadCollectionsForDate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const totalCollected = Object.values(collectedByStudent).reduce((sum, r) => sum + r.amount, 0);
  const studentsPaidCount = Object.keys(collectedByStudent).length;

  async function handleRecord(studentId: string) {
    const amountStr = amounts[studentId];
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount first.");
      return;
    }
    setSaving(studentId);
    try {
      const record = await api.post<FeedingCollection>("/feeding", {
        student_id: studentId,
        collection_date: date,
        amount,
        payment_method: method,
      });
      toast.success("Feeding money recorded.");
      setAmounts({ ...amounts, [studentId]: "" });
      // Reflect it immediately in the table without a full reload.
      setCollectedByStudent((prev) => ({ ...prev, [studentId]: record }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not record this collection.");
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete(studentId: string, recordId: string) {
    if (!confirm("Delete this feeding money record? This can't be undone.")) return;
    try {
      await api.delete(`/feeding/${recordId}`);
      toast.success("Record deleted.");
      setCollectedByStudent((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete this record.");
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
            GHS {totalCollected.toFixed(2)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-plum-800/50">
            Students who paid
          </p>
          <p className="font-display text-3xl font-semibold text-violet-600 mt-2">
            {studentsPaidCount}
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
              <th className="px-5 py-3 font-semibold">Collected today</th>
              <th className="px-5 py-3 font-semibold">Amount (GHS)</th>
              <th className="px-5 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const existing = collectedByStudent[s.id];
              return (
                <tr key={s.id} className="border-t border-blush-100">
                  <td className="px-5 py-3 font-medium">{s.full_name}</td>
                  <td className="px-5 py-3">
                    {loadingCollections ? (
                      <span className="text-plum-800/30 text-xs">…</span>
                    ) : existing ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="pill bg-green-100 text-green-700">
                          GHS {existing.amount.toFixed(2)} · {existing.payment_method}
                        </span>
                        <button
                          onClick={() => handleDelete(s.id, existing.id)}
                          className="text-xs text-red-500 hover:text-red-700 hover:underline"
                          title="Delete this record"
                        >
                          Delete
                        </button>
                      </span>
                    ) : (
                      <span className="pill bg-blush-50 text-plum-800/40">Not paid yet</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input w-32"
                      placeholder={existing ? "Update amount" : "0.00"}
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
                      {saving === s.id ? "Saving…" : existing ? "Update" : "Record"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-plum-800/50">
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
