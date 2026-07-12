"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { removeFromOutbox } from "@/lib/offline/db";
import { FeedingCollection, Paginated, Student } from "@/lib/types";
import Pagination from "@/components/Pagination";
import ExportButtons from "@/components/ExportButtons";

const PAGE_SIZE = 15;

export default function FeedingPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
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
  const [dayTotal, setDayTotal] = useState({ total_collected: 0, number_of_students: 0 });

  async function loadStudents() {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
    const s = await api.get<Paginated<Student>>(
      `/students?page=${page}&page_size=${PAGE_SIZE}${searchParam}`
    );
    setStudents(s.items);
    setTotal(s.total);
    setTotalPages(s.total_pages);
  }

  async function loadCollectionsForDate() {
    setLoadingCollections(true);
    try {
      // A day's collections are naturally bounded by the number of active
      // students, so one large page covers "today" in a single request —
      // this dataset is a same-day cross-reference, not a growing list.
      const [rows, summary] = await Promise.all([
        api.get<Paginated<FeedingCollection>>(`/feeding?on_date=${date}&page_size=1000`),
        api.get<{ total_collected: number; number_of_students: number }>(
          `/feeding/summary/daily?on_date=${date}`
        ),
      ]);
      const byStudent: Record<string, FeedingCollection> = {};
      rows.items.forEach((r) => (byStudent[r.student_id] = r));
      setCollectedByStudent(byStudent);
      setDayTotal(summary);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not load today's collections.");
    } finally {
      setLoadingCollections(false);
    }
  }

  useEffect(() => {
    loadStudents().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    loadCollectionsForDate();
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
      const record = await api.post<FeedingCollection>("/feeding", {
        student_id: studentId,
        collection_date: date,
        amount,
        payment_method: method,
      });
      if (record._offline) {
        toast("Saved on this device — will sync once you're back online.", { icon: "📴" });
      } else {
        toast.success("Feeding money recorded.");
      }
      setAmounts({ ...amounts, [studentId]: "" });
      // Reflect it immediately in the table without a full reload.
      setCollectedByStudent((prev) => {
        const existed = prev[studentId];
        const next = { ...prev, [studentId]: record };
        setDayTotal((t) => ({
          total_collected: t.total_collected - (existed?.amount ?? 0) + record.amount,
          number_of_students: existed ? t.number_of_students : t.number_of_students + 1,
        }));
        return next;
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not record this collection.");
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete(studentId: string, record: FeedingCollection) {
    if (!confirm("Delete this feeding money record? This can't be undone.")) return;
    try {
      if (record._offline) {
        // Hasn't synced yet — just cancel the queued write.
        await removeFromOutbox(record.id.replace("offline-", ""));
      } else {
        await api.delete(`/feeding/${record.id}`);
      }
      toast.success("Record deleted.");
      setCollectedByStudent((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      setDayTotal((t) => ({
        total_collected: t.total_collected - record.amount,
        number_of_students: t.number_of_students - 1,
      }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete this record.");
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-plum-800">Morning Feeding Money</h1>
          <p className="text-plum-800/60 text-sm mt-1">
            Record what each child brings for breakfast/lunch.
          </p>
        </div>
        <ExportButtons
          basePath={`/exports/feeding?on_date=${date}`}
          filename={`dreston-elite-feeding-${date}`}
        />
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-plum-800/50">
            Collected today
          </p>
          <p className="font-display text-3xl font-semibold text-gold-500 mt-2">
            GHS {dayTotal.total_collected.toFixed(2)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-plum-800/50">
            Students who paid
          </p>
          <p className="font-display text-3xl font-semibold text-violet-600 mt-2">
            {dayTotal.number_of_students}
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
                        <span
                          className={`pill ${
                            existing._offline
                              ? "bg-gold-400/30 text-gold-500"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {existing._offline && "⏳ "}
                          GHS {existing.amount.toFixed(2)} · {existing.payment_method}
                        </span>
                        <button
                          onClick={() => handleDelete(s.id, existing)}
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

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} itemLabel="students" />
    </div>
  );
}
