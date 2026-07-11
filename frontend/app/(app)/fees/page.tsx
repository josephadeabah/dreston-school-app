"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { FeeTerm, Student, StudentFeeBalance } from "@/lib/types";

export default function FeesPage() {
  const [terms, setTerms] = useState<FeeTerm[]>([]);
  const [termId, setTermId] = useState("");
  const [balances, setBalances] = useState<StudentFeeBalance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [payment, setPayment] = useState({
    student_id: "",
    amount: "",
    payment_method: "cash" as "cash" | "momo" | "bank" | "card",
    reference: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<FeeTerm[]>("/fees/terms").then((t) => {
      setTerms(t);
      if (t.length) setTermId(t[0].id);
    });
    api.get<Student[]>("/students").then(setStudents);
  }, []);

  useEffect(() => {
    if (!termId) return;
    api
      .get<StudentFeeBalance[]>(`/fees/balances/${termId}`)
      .then(setBalances)
      .catch((e) => toast.error(e.message));
  }, [termId]);

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payment.student_id || !payment.amount) {
      toast.error("Choose a student and enter an amount.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/fees/payments", {
        student_id: payment.student_id,
        term_id: termId || null,
        amount: parseFloat(payment.amount),
        payment_method: payment.payment_method,
        reference: payment.reference || null,
      });
      toast.success("Payment recorded.");
      setPayment({ student_id: "", amount: "", payment_method: "cash", reference: "" });
      if (termId) {
        api.get<StudentFeeBalance[]>(`/fees/balances/${termId}`).then(setBalances);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not record this payment.");
    } finally {
      setSaving(false);
    }
  }

  const totalDue = balances.reduce((sum, b) => sum + b.amount_due, 0);
  const totalPaid = balances.reduce((sum, b) => sum + b.amount_paid, 0);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-plum-800">School Fees</h1>
          <p className="text-plum-800/60 text-sm mt-1">
            Track fee payments and outstanding balances per term.
          </p>
        </div>
        <select className="input max-w-xs" value={termId} onChange={(e) => setTermId(e.target.value)}>
          {terms.length === 0 && <option>No terms yet — create one in Supabase</option>}
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-plum-800/50">
            Total Due
          </p>
          <p className="font-display text-2xl font-semibold text-plum-800 mt-2">
            GHS {totalDue.toFixed(2)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-plum-800/50">
            Total Paid
          </p>
          <p className="font-display text-2xl font-semibold text-gold-500 mt-2">
            GHS {totalPaid.toFixed(2)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-plum-800/50">
            Outstanding
          </p>
          <p className="font-display text-2xl font-semibold text-violet-600 mt-2">
            GHS {(totalDue - totalPaid).toFixed(2)}
          </p>
        </div>
      </div>

      <form onSubmit={handlePayment} className="card mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div className="sm:col-span-2">
          <label className="label">Student</label>
          <select
            className="input"
            value={payment.student_id}
            onChange={(e) => setPayment({ ...payment, student_id: e.target.value })}
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Amount (GHS)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={payment.amount}
            onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Method</label>
          <select
            className="input"
            value={payment.payment_method}
            onChange={(e) =>
              setPayment({ ...payment, payment_method: e.target.value as typeof payment.payment_method })
            }
          >
            <option value="cash">Cash</option>
            <option value="momo">Mobile Money</option>
            <option value="bank">Bank</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Recording…" : "Record payment"}
          </button>
        </div>
      </form>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-blush-100 text-plum-800/70 text-left">
            <tr>
              <th className="px-5 py-3 font-semibold">Student</th>
              <th className="px-5 py-3 font-semibold">Due</th>
              <th className="px-5 py-3 font-semibold">Paid</th>
              <th className="px-5 py-3 font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.student_id} className="border-t border-blush-100">
                <td className="px-5 py-3 font-medium">{b.full_name}</td>
                <td className="px-5 py-3">GHS {b.amount_due.toFixed(2)}</td>
                <td className="px-5 py-3">GHS {b.amount_paid.toFixed(2)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`pill ${
                      b.balance > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}
                  >
                    GHS {b.balance.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
            {balances.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-plum-800/50">
                  No fee data yet for this term.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
