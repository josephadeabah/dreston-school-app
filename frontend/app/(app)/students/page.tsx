"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { ClassItem, Guardian, Student } from "@/lib/types";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [allGuardians, setAllGuardians] = useState<Guardian[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    admission_no: "",
    full_name: "",
    date_of_birth: "",
    class_id: "",
  });

  // Guardian panel state — which student's panel is open, their linked
  // guardians, and the pending "link an existing guardian" selection.
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [guardiansByStudent, setGuardiansByStudent] = useState<Record<string, Guardian[]>>({});
  const [loadingGuardiansFor, setLoadingGuardiansFor] = useState<string | null>(null);
  const [selectedGuardianToLink, setSelectedGuardianToLink] = useState("");
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  async function load() {
    const [s, c, g] = await Promise.all([
      api.get<Student[]>(`/students${search ? `?search=${encodeURIComponent(search)}` : ""}`),
      api.get<ClassItem[]>("/classes"),
      api.get<Guardian[]>("/guardians"),
    ]);
    setStudents(s);
    setClasses(c);
    setAllGuardians(g);
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
      toast.success(
        `${form.full_name} was added. Don't forget to link a guardian below so messages can reach home.`
      );
      setForm({ admission_no: "", full_name: "", date_of_birth: "", class_id: "" });
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not add this student.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(student: Student) {
    if (
      !confirm(
        `Remove ${student.full_name} from the active roster? Their attendance, fee, and feeding history is kept — this just takes them off the current lists.`
      )
    )
      return;
    setRemovingId(student.id);
    try {
      await api.delete(`/students/${student.id}`);
      toast.success(`${student.full_name} was removed from the roster.`);
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not remove this student.");
    } finally {
      setRemovingId(null);
    }
  }

  async function toggleGuardianPanel(studentId: string) {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
      return;
    }
    setExpandedStudentId(studentId);
    setSelectedGuardianToLink("");
    if (!guardiansByStudent[studentId]) {
      setLoadingGuardiansFor(studentId);
      try {
        const g = await api.get<Guardian[]>(`/students/${studentId}/guardians`);
        setGuardiansByStudent((prev) => ({ ...prev, [studentId]: g }));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Could not load guardians.");
      } finally {
        setLoadingGuardiansFor(null);
      }
    }
  }

  async function handleLinkGuardian(studentId: string) {
    if (!selectedGuardianToLink) {
      toast.error("Choose a guardian to link first.");
      return;
    }
    setLinking(true);
    try {
      const linked = await api.post<Guardian>(`/students/${studentId}/guardians`, {
        guardian_id: selectedGuardianToLink,
      });
      setGuardiansByStudent((prev) => ({
        ...prev,
        [studentId]: [...(prev[studentId] ?? []), linked],
      }));
      setSelectedGuardianToLink("");
      toast.success(`${linked.full_name} linked — they'll now receive messages for this child.`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not link this guardian.");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlinkGuardian(studentId: string, guardianId: string) {
    setUnlinkingId(guardianId);
    try {
      await api.delete(`/students/${studentId}/guardians/${guardianId}`);
      setGuardiansByStudent((prev) => ({
        ...prev,
        [studentId]: (prev[studentId] ?? []).filter((g) => g.id !== guardianId),
      }));
      toast.success("Guardian unlinked from this student.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not unlink this guardian.");
    } finally {
      setUnlinkingId(null);
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
              <th className="px-5 py-3 font-semibold">Guardians</th>
              <th className="px-5 py-3 font-semibold w-20"></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const isExpanded = expandedStudentId === s.id;
              const linkedGuardians = guardiansByStudent[s.id];
              const linkedCount = linkedGuardians?.length ?? null;
              const availableToLink = allGuardians.filter(
                (g) => !linkedGuardians?.some((lg) => lg.id === g.id)
              );

              return (
                <Fragment key={s.id}>
                  <tr className="border-t border-blush-100">
                    <td className="px-5 py-3 font-mono text-xs text-plum-800/70">
                      {s.admission_no}
                    </td>
                    <td className="px-5 py-3 font-medium">{s.full_name}</td>
                    <td className="px-5 py-3">{classNameFor(s.class_id)}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggleGuardianPanel(s.id)}
                        className={`pill ${
                          linkedCount === 0
                            ? "bg-red-100 text-red-700"
                            : linkedCount
                            ? "bg-green-100 text-green-700"
                            : "bg-blush-50 text-plum-800/40"
                        }`}
                      >
                        {linkedCount === null
                          ? "View guardians"
                          : linkedCount === 0
                          ? "No guardians linked"
                          : `${linkedCount} linked`}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleRemove(s)}
                        disabled={removingId === s.id}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        {removingId === s.id ? "…" : "Remove"}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-blush-50/60 border-t border-blush-100">
                      <td colSpan={5} className="px-5 py-4">
                        {loadingGuardiansFor === s.id ? (
                          <p className="text-plum-800/50 text-xs">Loading guardians…</p>
                        ) : (
                          <div className="space-y-3">
                            {linkedGuardians && linkedGuardians.length > 0 ? (
                              <ul className="space-y-1.5">
                                {linkedGuardians.map((g) => (
                                  <li
                                    key={g.id}
                                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm"
                                  >
                                    <span>
                                      <span className="font-medium">{g.full_name}</span>{" "}
                                      <span className="text-plum-800/50 font-mono text-xs">
                                        {g.phone}
                                      </span>{" "}
                                      <span className="text-plum-800/40 text-xs capitalize">
                                        ({g.relationship})
                                      </span>
                                    </span>
                                    <button
                                      onClick={() => handleUnlinkGuardian(s.id, g.id)}
                                      disabled={unlinkingId === g.id}
                                      className="text-xs text-red-500 hover:text-red-700 hover:underline"
                                    >
                                      {unlinkingId === g.id ? "…" : "Unlink"}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-red-600">
                                No guardians linked yet — messages sent to this student&apos;s
                                guardians won&apos;t reach anyone until you link one.
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                className="input max-w-xs"
                                value={selectedGuardianToLink}
                                onChange={(e) => setSelectedGuardianToLink(e.target.value)}
                              >
                                <option value="">
                                  {availableToLink.length === 0
                                    ? "No more guardians to link"
                                    : "Link an existing guardian…"}
                                </option>
                                {availableToLink.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.full_name} · {g.phone}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="btn-secondary text-xs"
                                disabled={linking || !selectedGuardianToLink}
                                onClick={() => handleLinkGuardian(s.id)}
                              >
                                {linking ? "Linking…" : "Link"}
                              </button>
                              <Link
                                href="/guardians"
                                className="text-xs text-violet-600 hover:underline"
                              >
                                + Add a new guardian
                              </Link>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-plum-800/50">
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
