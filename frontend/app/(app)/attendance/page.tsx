"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { AttendanceRecord, ClassItem, Student } from "@/lib/types";

type Status = "present" | "absent" | "late" | "excused";

const STATUS_STYLES: Record<Status, string> = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-gold-400/30 text-gold-500",
  excused: "bg-violet-100 text-violet-600",
};

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [savedMarks, setSavedMarks] = useState<Record<string, Status>>({});
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    api.get<ClassItem[]>("/classes").then(setClasses).catch((e) => toast.error(e.message));
  }, []);

  // Whenever the class or date changes, load the roster AND any attendance
  // already marked for that day, so staff see the real current state
  // instead of everything defaulting back to "present".
  useEffect(() => {
    if (!classId) return;
    setLoadingSheet(true);
    setLastSavedAt(null);

    Promise.all([
      api.get<Student[]>(`/students?class_id=${classId}`),
      api.get<AttendanceRecord[]>(
        `/attendance/for-class?class_id=${classId}&on_date=${date}`
      ),
    ])
      .then(([studentList, existingRecords]) => {
        setStudents(studentList);

        const existingByStudent: Record<string, Status> = {};
        existingRecords.forEach((r) => (existingByStudent[r.student_id] = r.status));

        const nextMarks: Record<string, Status> = {};
        studentList.forEach((s) => {
          nextMarks[s.id] = existingByStudent[s.id] ?? "present";
        });

        setMarks(nextMarks);
        setSavedMarks(existingByStudent);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoadingSheet(false));
  }, [classId, date]);

  const hasUnsavedChanges = students.some(
    (s) => marks[s.id] !== (savedMarks[s.id] ?? "present") || !(s.id in savedMarks)
  );

  async function handleSave() {
    if (!classId) return;
    setSaving(true);
    try {
      const records = await api.post<AttendanceRecord[]>("/attendance/mark", {
        class_id: classId,
        attendance_date: date,
        records: Object.entries(marks).map(([student_id, status]) => ({
          student_id,
          status,
        })),
      });

      const nowSaved: Record<string, Status> = {};
      records.forEach((r) => (nowSaved[r.student_id] = r.status));
      setSavedMarks(nowSaved);
      setLastSavedAt(new Date().toLocaleTimeString());
      toast.success("Attendance saved.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  }

  const presentCount = Object.values(marks).filter((s) => s === "present").length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-plum-800">Attendance</h1>
        <p className="text-plum-800/60 text-sm mt-1">
          Mark who&apos;s here today, class by class.
        </p>
      </header>

      <div className="card mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="label">Class</label>
          <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Select a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {classId && !loadingSheet && (
          <div className="text-sm text-plum-800/60">
            <span className="font-semibold text-violet-600">{presentCount}</span> /{" "}
            {students.length} marked present
          </div>
        )}

        <div className="flex-1" />

        <div className="text-right">
          {lastSavedAt && !hasUnsavedChanges && (
            <p className="text-xs text-green-600 mb-2">✓ Saved at {lastSavedAt}</p>
          )}
          {hasUnsavedChanges && students.length > 0 && (
            <p className="text-xs text-gold-500 mb-2">Unsaved changes</p>
          )}
          <button
            className="btn-primary"
            disabled={!classId || saving || students.length === 0}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save attendance"}
          </button>
        </div>
      </div>

      {classId && (
        <div className="card p-0 overflow-hidden">
          {loadingSheet ? (
            <p className="px-5 py-8 text-center text-plum-800/50">Loading roster…</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-blush-100 text-plum-800/70 text-left">
                <tr>
                  <th className="px-5 py-3 font-semibold">Student</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold w-24">Saved</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const isSaved = savedMarks[s.id] === marks[s.id] && s.id in savedMarks;
                  return (
                    <tr key={s.id} className="border-t border-blush-100">
                      <td className="px-5 py-3 font-medium">{s.full_name}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          {(["present", "absent", "late", "excused"] as Status[]).map((st) => (
                            <button
                              key={st}
                              onClick={() => setMarks({ ...marks, [s.id]: st })}
                              className={`pill capitalize transition ${
                                marks[s.id] === st
                                  ? STATUS_STYLES[st]
                                  : "bg-blush-50 text-plum-800/40 hover:bg-blush-100"
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {isSaved ? (
                          <span className="text-green-600 text-xs">✓ saved</span>
                        ) : (
                          <span className="text-gold-500 text-xs">pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-plum-800/50">
                      No students in this class yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
