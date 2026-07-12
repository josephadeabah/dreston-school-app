"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { Paginated, Staff } from "@/lib/types";
import Pagination from "@/components/Pagination";
import ExportButtons from "@/components/ExportButtons";

const PAGE_SIZE = 15;

const ROLE_LABELS: Record<Staff["role"], string> = {
  admin: "Admin",
  teacher: "Teacher",
  accountant: "Accountant",
  front_desk: "Front Desk",
};

const ROLE_STYLES: Record<Staff["role"], string> = {
  admin: "bg-violet-100 text-violet-600",
  teacher: "bg-gold-400/30 text-gold-500",
  accountant: "bg-green-100 text-green-700",
  front_desk: "bg-blush-100 text-plum-800",
};

export default function StaffPage() {
  const { profile } = useAuth(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "teacher" as Staff["role"],
    phone: "",
  });

  const isAdmin = profile?.role === "admin";

  async function load() {
    const s = await api.get<Paginated<Staff>>(`/staff?page=${page}&page_size=${PAGE_SIZE}`);
    setStaff(s.items);
    setTotal(s.total);
    setTotalPages(s.total_pages);
  }

  useEffect(() => {
    if (!isAdmin) return;
    load().catch((e) => toast.error(e instanceof ApiError ? e.message : "Could not load staff."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, isAdmin]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Use a password with at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/staff", {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
        phone: form.phone || null,
      });
      toast.success(
        form.role === "admin"
          ? `${form.full_name} was added as an admin.`
          : `${form.full_name} was added.`
      );
      setForm({ full_name: "", email: "", password: "", role: "teacher", phone: "" });
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not create this staff account.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(member: Staff) {
    const action = member.is_active ? "deactivate" : "reactivate";
    if (member.is_active && !confirm(`Deactivate ${member.full_name}? They won't be able to log in.`))
      return;
    setUpdatingId(member.id);
    try {
      await api.patch(`/staff/${member.id}/${action}`, {});
      toast.success(`${member.full_name} was ${member.is_active ? "deactivated" : "reactivated"}.`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : `Could not ${action} this staff member.`);
    } finally {
      setUpdatingId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="card max-w-md">
        <h1 className="text-lg font-semibold text-plum-800 mb-2">Staff</h1>
        <p className="text-plum-800/60 text-sm">
          Only school admins can view and manage staff accounts.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-plum-800">Staff</h1>
          <p className="text-plum-800/60 text-sm mt-1">
            {total} account{total === 1 ? "" : "s"} · Admins can create other admins here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons basePath="/exports/staff" filename="dreston-elite-staff" />
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add staff"}
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
            <label className="label">Email (their login)</label>
            <input
              type="email"
              className="input"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Temporary password</label>
            <input
              type="text"
              className="input"
              required
              placeholder="At least 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <input
              className="input"
              placeholder="+233241234567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Role</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Staff["role"] })}
            >
              <option value="teacher">Teacher</option>
              <option value="accountant">Accountant</option>
              <option value="front_desk">Front Desk</option>
              <option value="admin">Admin (full access, including managing other staff)</option>
            </select>
            {form.role === "admin" && (
              <p className="text-xs text-gold-500 mt-1.5">
                Admins can do everything, including creating and deactivating other staff
                accounts — including other admins. Only grant this to people you fully trust.
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-blush-100 text-plum-800/70 text-left">
            <tr>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Phone</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold w-28"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((m) => (
              <tr key={m.id} className="border-t border-blush-100">
                <td className="px-5 py-3 font-medium">
                  {m.full_name}
                  {m.id === profile?.id && (
                    <span className="text-plum-800/40 text-xs ml-1.5">(you)</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`pill ${ROLE_STYLES[m.role]}`}>{ROLE_LABELS[m.role]}</span>
                </td>
                <td className="px-5 py-3 text-plum-800/70">{m.phone ?? "—"}</td>
                <td className="px-5 py-3">
                  <span
                    className={`pill ${
                      m.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {m.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {m.id !== profile?.id && (
                    <button
                      onClick={() => handleToggleActive(m)}
                      disabled={updatingId === m.id}
                      className={`text-xs hover:underline ${
                        m.is_active ? "text-red-500 hover:text-red-700" : "text-violet-600"
                      }`}
                    >
                      {updatingId === m.id ? "…" : m.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-plum-800/50">
                  No staff accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} itemLabel="staff" />
    </div>
  );
}
