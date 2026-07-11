"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { ClassItem, Student } from "@/lib/types";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    admission_no: "",
    full_name: "",
    date_of_birth: "",
    class_id: "",
  });

  async function load() {
    const [s, c] = await Promise.all([
      api.get<Student[]>(`/students${search ? `?search=${encodeURIComponent(search)}` : ""}`),
      api.get<ClassItem[]>("/classes"),
    ]);
    setStudents(s);
    setClasses(c);
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function classNameFor(id: string | null) {
    return classes.find((c) => c.id === id)?.name ?? "—";
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/students", {
        admission_no: form.admission_no,
        full_name: form.full_name,
        date_of_birth: form.date_of_birth || null,
        class_id: form.class_id || null,
        guardian_ids: [],
      });
      toast.success(`${form.full_name} was added.`);
      setForm({ admission_no: "", full_name: "", date_of_birth: "", class_id: "" });
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not add this student.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-plum-800">Students</h1>
          <p className="text-plum-800/60 text-sm mt-1">{students.length} enrolled</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add student"}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleAdd} className="card mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Admission number</label>
            <input
              className="input"
              required
              value={form.admission_no}
              onChange={(e) => setForm({ ...form, admission_no: e.target.value })}
            />
          </div>
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
            <label className="label">Date of birth</label>
            <input
              type="date"
              className="input"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Class</label>
            <select
              className="input"
              value={form.class_id}
              onChange={(e) => setForm({ ...form, class_id: e.target.value })}
            >
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save student"}
            </button>
          </div>
        </form>
      )}

      <input
        className="input mb-4 max-w-sm"
        placeholder="Search students…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-blush-100 text-plum-800/70 text-left">
            <tr>
              <th className="px-5 py-3 font-semibold">Admission #</th>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Class</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t border-blush-100">
                <td className="px-5 py-3 font-mono text-xs text-plum-800/70">
                  {s.admission_no}
                </td>
                <td className="px-5 py-3 font-medium">{s.full_name}</td>
                <td className="px-5 py-3">{classNameFor(s.class_id)}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-plum-800/50">
                  No students found. Try adding one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
