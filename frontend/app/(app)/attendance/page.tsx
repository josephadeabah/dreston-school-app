"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { ClassItem, Student } from "@/lib/types";

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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<ClassItem[]>("/classes").then(setClasses).catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    if (!classId) return;
    api
      .get<Student[]>(`/students?class_id=${classId}`)
      .then((s) => {
        setStudents(s);
        const initial: Record<string, Status> = {};
        s.forEach((st) => (initial[st.id] = "present"));
        setMarks(initial);
      })
      .catch((e) => toast.error(e.message));
  }, [classId]);

  async function handleSave() {
    if (!classId) return;
    setSaving(true);
    try {
      await api.post("/attendance/mark", {
        class_id: classId,
        date,
        records: Object.entries(marks).map(([student_id, status]) => ({
          student_id,
          status,
        })),
      });
      toast.success("Attendance saved.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  }

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
        <button
          className="btn-primary"
          disabled={!classId || saving || students.length === 0}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save attendance"}
        </button>
      </div>

      {classId && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-blush-100 text-plum-800/70 text-left">
              <tr>
                <th className="px-5 py-3 font-semibold">Student</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
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
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-8 text-center text-plum-800/50">
                    No students in this class yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
