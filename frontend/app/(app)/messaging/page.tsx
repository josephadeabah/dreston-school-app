"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { Broadcast, ClassItem, Student } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gold-400/30 text-gold-500",
  sending: "bg-violet-100 text-violet-600",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function MessagingPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    channel: "sms" as "sms" | "email" | "both" | "in_app",
    audience: "all" as "all" | "class" | "student",
    class_id: "",
    student_id: "",
  });

  async function loadBroadcasts() {
    const b = await api.get<Broadcast[]>("/broadcasts");
    setBroadcasts(b);
  }

  useEffect(() => {
    loadBroadcasts().catch((e) => toast.error(e.message));
    api.get<ClassItem[]>("/classes").then(setClasses);
    api.get<Student[]>("/students").then(setStudents);
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await api.post("/broadcasts", {
        title: form.title,
        body: form.body,
        channel: form.channel,
        audience: form.audience,
        class_id: form.audience === "class" ? form.class_id : null,
        student_id: form.audience === "student" ? form.student_id : null,
      });
      toast.success("Message is being sent to parents.");
      setForm({ title: "", body: "", channel: "sms", audience: "all", class_id: "", student_id: "" });
      loadBroadcasts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send this message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-plum-800">Messages Home</h1>
        <p className="text-plum-800/60 text-sm mt-1">
          Broadcast SMS or email to parents — for the whole school, a class, or one child.
        </p>
      </header>

      <form onSubmit={handleSend} className="card mb-8 space-y-4">
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            required
            placeholder="e.g. School closed Friday"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea
            className="input min-h-[100px]"
            required
            placeholder="Write the message parents will receive…"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Send via</label>
            <select
              className="input"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value as typeof form.channel })}
            >
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="both">SMS + Email</option>
              <option value="in_app">In-app only</option>
            </select>
          </div>
          <div>
            <label className="label">Audience</label>
            <select
              className="input"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as typeof form.audience })}
            >
              <option value="all">Whole school</option>
              <option value="class">One class</option>
              <option value="student">One student&apos;s guardians</option>
            </select>
          </div>

          {form.audience === "class" && (
            <div>
              <label className="label">Class</label>
              <select
                className="input"
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.audience === "student" && (
            <div>
              <label className="label">Student</label>
              <select
                className="input"
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              >
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button type="submit" className="btn-primary" disabled={sending}>
          {sending ? "Sending…" : "Send message"}
        </button>
      </form>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-blush-100 text-plum-800/70 text-left">
            <tr>
              <th className="px-5 py-3 font-semibold">Title</th>
              <th className="px-5 py-3 font-semibold">Channel</th>
              <th className="px-5 py-3 font-semibold">Audience</th>
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => (
              <tr key={b.id} className="border-t border-blush-100">
                <td className="px-5 py-3 font-medium">{b.title}</td>
                <td className="px-5 py-3 uppercase text-xs">{b.channel}</td>
                <td className="px-5 py-3 capitalize">{b.audience}</td>
                <td className="px-5 py-3">
                  <span className={`pill capitalize ${STATUS_STYLES[b.status]}`}>{b.status}</span>
                </td>
              </tr>
            ))}
            {broadcasts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-plum-800/50">
                  No messages sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
