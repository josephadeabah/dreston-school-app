"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { Guardian, Paginated } from "@/lib/types";
import Pagination from "@/components/Pagination";
import ExportButtons from "@/components/ExportButtons";

const PAGE_SIZE = 15;

export default function GuardiansPage() {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    relationship: "parent",
  });

  async function load() {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
    const g = await api.get<Paginated<Guardian>>(
      `/guardians?page=${page}&page_size=${PAGE_SIZE}${searchParam}`
    );
    setGuardians(g.items);
    setTotal(g.total);
    setTotalPages(g.total_pages);
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone.startsWith("+")) {
      toast.error("Enter the phone number in international format, e.g. +233241234567.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/guardians", {
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || null,
        relationship: form.relationship,
      });
      toast.success(`${form.full_name} was added.`);
      setForm({ full_name: "", phone: "", email: "", relationship: "parent" });
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not add this guardian.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(g: Guardian) {
    if (!confirm(`Delete ${g.full_name}? This also removes them from any student they're linked to.`))
      return;
    setDeletingId(g.id);
    try {
      await api.delete(`/guardians/${g.id}`);
      toast.success(`${g.full_name} was deleted.`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete this guardian.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-plum-800">Guardians</h1>
          <p className="text-plum-800/60 text-sm mt-1">
            Parents and guardians who receive SMS/email messages. Link them to a child from the
            Students page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons basePath="/exports/guardians" filename="dreston-elite-guardians" />
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add guardian"}
          </button>
        </div>
      </header>

      {showForm && (
        <form onSubmit={handleAdd} className="card mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full name</label>
            <input
              className="input"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Phone (for SMS)</label>
            <input
              className="input"
              required
              placeholder="+233241234567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email (optional)</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Relationship</label>
            <select
              className="input"
              value={form.relationship}
              onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            >
              <option value="parent">Parent</option>
              <option value="guardian">Guardian</option>
              <option value="sponsor">Sponsor</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save guardian"}
            </button>
          </div>
        </form>
      )}

      <input
        className="input mb-4 max-w-sm"
        placeholder="Search guardians…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-blush-100 text-plum-800/70 text-left">
            <tr>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Phone</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Relationship</th>
              <th className="px-5 py-3 font-semibold w-20"></th>
            </tr>
          </thead>
          <tbody>
            {guardians.map((g) => (
              <tr key={g.id} className="border-t border-blush-100">
                <td className="px-5 py-3 font-medium">{g.full_name}</td>
                <td className="px-5 py-3 font-mono text-xs">{g.phone}</td>
                <td className="px-5 py-3 text-plum-800/70">{g.email ?? "—"}</td>
                <td className="px-5 py-3 capitalize">{g.relationship}</td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => handleDelete(g)}
                    disabled={deletingId === g.id}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline"
                  >
                    {deletingId === g.id ? "…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
            {guardians.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-plum-800/50">
                  No guardians yet. Add one above, then link them to a student from the Students
                  page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} itemLabel="guardians" />
    </div>
  );
}
