"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import {
  ClassItem,
  FeePayment,
  FeeStructure,
  FeeTerm,
  Student,
  StudentFeeBalance,
} from "@/lib/types";

export default function FeesPage() {
  const [terms, setTerms] = useState<FeeTerm[]>([]);
  const [termId, setTermId] = useState("");
  const [balances, setBalances] = useState<StudentFeeBalance[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  const [showTermForm, setShowTermForm] = useState(false);
  const [showStructureForm, setShowStructureForm] = useState(false);
  const [deletingTerm, setDeletingTerm] = useState(false);
  const [deletingStructureId, setDeletingStructureId] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  const [termForm, setTermForm] = useState({ name: "", start_date: "", end_date: "" });
  const [structureForm, setStructureForm] = useState({ class_id: "", amount_due: "" });
  const [savingTerm, setSavingTerm] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);

  const [payment, setPayment] = useState({
    student_id: "",
    amount: "",
    payment_method: "cash" as "cash" | "momo" | "bank" | "card",
    reference: "",
  });
  const [saving, setSaving] = useState(false);

  function classNameFor(id: string) {
    return classes.find((c) => c.id === id)?.name ?? "—";
  }
  function studentNameFor(id: string) {
    return students.find((s) => s.id === id)?.full_name ?? "Unknown student";
  }

  async function loadTerms() {
    const t = await api.get<FeeTerm[]>("/fees/terms");
    setTerms(t);
    return t;
  }

  async function loadTermData(id: string) {
    if (!id) {
      setBalances([]);
      setStructures([]);
      setPayments([]);
      return;
    }
    setLoadingBalances(true);
    try {
      const [b, s, p] = await Promise.all([
        api.get<StudentFeeBalance[]>(`/fees/balances/${id}`),
        api.get<FeeStructure[]>(`/fees/structures?term_id=${id}`),
        api.get<FeePayment[]>(`/fees/payments?term_id=${id}`),
      ]);
      setBalances(b);
      setStructures(s);
      setPayments(p);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not load fee data for this term.");
    } finally {
      setLoadingBalances(false);
    }
  }

  useEffect(() => {
    loadTerms().then((t) => {
      if (t.length) setTermId(t[0].id);
    });
    api.get<Student[]>("/students").then(setStudents);
    api.get<ClassItem[]>("/classes").then(setClasses);
  }, []);

  useEffect(() => {
    loadTermData(termId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId]);

  async function handleCreateTerm(e: React.FormEvent) {
    e.preventDefault();
    if (!termForm.name.trim()) {
      toast.error("Give the term a name, e.g. 'Term 1 2026/2027'.");
      return;
    }
    setSavingTerm(true);
    try {
      const created = await api.post<FeeTerm>("/fees/terms", {
        name: termForm.name,
        start_date: termForm.start_date || null,
        end_date: termForm.end_date || null,
      });
      toast.success(`"${created.name}" was created.`);
      setTermForm({ name: "", start_date: "", end_date: "" });
      setShowTermForm(false);
      await loadTerms();
      setTermId(created.id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not create this term.");
    } finally {
      setSavingTerm(false);
    }
  }

  async function handleDeleteTerm() {
    if (!termId) return;
    const term = terms.find((t) => t.id === termId);
    if (
      !confirm(
        `Delete "${term?.name}"? This also removes its fee-per-class amounts. Payments already recorded are kept, just unlinked from this term. This can't be undone.`
      )
    )
      return;
    setDeletingTerm(true);
    try {
      await api.delete(`/fees/terms/${termId}`);
      toast.success("Term deleted.");
      const updated = await loadTerms();
      setTermId(updated[0]?.id ?? "");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete this term.");
    } finally {
      setDeletingTerm(false);
    }
  }

  async function handleSetStructure(e: React.FormEvent) {
    e.preventDefault();
    if (!termId) {
      toast.error("Create or select a term first.");
      return;
    }
    if (!structureForm.class_id || !structureForm.amount_due) {
      toast.error("Choose a class and enter the amount due.");
      return;
    }
    setSavingStructure(true);
    try {
      await api.post("/fees/structures", {
        term_id: termId,
        class_id: structureForm.class_id,
        amount_due: parseFloat(structureForm.amount_due),
      });
      toast.success("Fee amount set for this class.");
      setStructureForm({ class_id: "", amount_due: "" });
      setShowStructureForm(false);
      loadTermData(termId);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save the fee structure.");
    } finally {
      setSavingStructure(false);
    }
  }

  async function handleDeleteStructure(structureId: string) {
    if (!confirm("Remove this class's fee amount for the term?")) return;
    setDeletingStructureId(structureId);
    try {
      await api.delete(`/fees/structures/${structureId}`);
      toast.success("Fee structure removed.");
      loadTermData(termId);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not remove this fee structure.");
    } finally {
      setDeletingStructureId(null);
    }
  }

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
      if (termId) loadTermData(termId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not record this payment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm("Delete this payment? This can't be undone.")) return;
    setDeletingPaymentId(paymentId);
    try {
      await api.delete(`/fees/payments/${paymentId}`);
      toast.success("Payment deleted.");
      loadTermData(termId);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete this payment.");
    } finally {
      setDeletingPaymentId(null);
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
        <div className="flex items-center gap-2">
          <select
            className="input max-w-xs"
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
          >
            {terms.length === 0 && <option value="">No terms yet — create one →</option>}
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {termId && (
            <button
              className="text-xs text-red-500 hover:text-red-700 hover:underline"
              disabled={deletingTerm}
              onClick={handleDeleteTerm}
            >
              {deletingTerm ? "Deleting…" : "Delete term"}
            </button>
          )}
          <button className="btn-secondary" onClick={() => setShowTermForm((v) => !v)}>
            {showTermForm ? "Cancel" : "+ New term"}
          </button>
        </div>
      </header>

      {showTermForm && (
        <form onSubmit={handleCreateTerm} className="card mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div className="sm:col-span-2">
            <label className="label">Term name</label>
            <input
              className="input"
              required
              placeholder="e.g. Term 1 2026/2027"
              value={termForm.name}
              onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Start date</label>
            <input
              type="date"
              className="input"
              value={termForm.start_date}
              onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
            />
          </div>
          <div>
            <label className="label">End date</label>
            <input
              type="date"
              className="input"
              value={termForm.end_date}
              onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
            />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary" disabled={savingTerm}>
              {savingTerm ? "Creating…" : "Create term"}
            </button>
          </div>
        </form>
      )}

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

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-plum-800">Fee amount per class</h2>
        <button
          className="btn-secondary text-xs"
          disabled={!termId}
          onClick={() => setShowStructureForm((v) => !v)}
        >
          {showStructureForm ? "Cancel" : "+ Set class fee"}
        </button>
      </div>

      {showStructureForm && (
        <form
          onSubmit={handleSetStructure}
          className="card mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
        >
          <div>
            <label className="label">Class</label>
            <select
              className="input"
              value={structureForm.class_id}
              onChange={(e) => setStructureForm({ ...structureForm, class_id: e.target.value })}
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount due (GHS)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={structureForm.amount_due}
              onChange={(e) => setStructureForm({ ...structureForm, amount_due: e.target.value })}
            />
          </div>
          <div>
            <button type="submit" className="btn-primary" disabled={savingStructure}>
              {savingStructure ? "Saving…" : "Save fee amount"}
            </button>
          </div>
        </form>
      )}

      {structures.length > 0 && (
        <div className="card p-0 overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-blush-100 text-plum-800/70 text-left">
              <tr>
                <th className="px-5 py-3 font-semibold">Class</th>
                <th className="px-5 py-3 font-semibold">Amount due</th>
                <th className="px-5 py-3 font-semibold w-20"></th>
              </tr>
            </thead>
            <tbody>
              {structures.map((s) => (
                <tr key={s.id} className="border-t border-blush-100">
                  <td className="px-5 py-3 font-medium">{classNameFor(s.class_id)}</td>
                  <td className="px-5 py-3">GHS {s.amount_due.toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleDeleteStructure(s.id)}
                      disabled={deletingStructureId === s.id}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline"
                    >
                      {deletingStructureId === s.id ? "…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      <h2 className="font-display font-semibold text-plum-800 mb-3">Balances by student</h2>
      <div className="card p-0 overflow-hidden mb-6">
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
            {loadingBalances && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-plum-800/50">
                  Loading…
                </td>
              </tr>
            )}
            {!loadingBalances &&
              balances.map((b) => (
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
            {!loadingBalances && balances.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-plum-800/50">
                  No fee data yet for this term. Set a fee amount per class above to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="font-display font-semibold text-plum-800 mb-3">Recent payments</h2>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-blush-100 text-plum-800/70 text-left">
            <tr>
              <th className="px-5 py-3 font-semibold">Student</th>
              <th className="px-5 py-3 font-semibold">Amount</th>
              <th className="px-5 py-3 font-semibold">Method</th>
              <th className="px-5 py-3 font-semibold">Date</th>
              <th className="px-5 py-3 font-semibold w-20"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-blush-100">
                <td className="px-5 py-3 font-medium">{studentNameFor(p.student_id)}</td>
                <td className="px-5 py-3">GHS {p.amount.toFixed(2)}</td>
                <td className="px-5 py-3 capitalize">{p.payment_method}</td>
                <td className="px-5 py-3 text-plum-800/60">
                  {new Date(p.paid_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => handleDeletePayment(p.id)}
                    disabled={deletingPaymentId === p.id}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline"
                  >
                    {deletingPaymentId === p.id ? "…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-plum-800/50">
                  No payments recorded yet for this term.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
