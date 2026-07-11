import { addToOutbox, type OutboxItem } from "./db";

function describeMutation(method: string, path: string, body: any): string {
  if (path === "/attendance/mark") {
    return `Attendance for ${body?.records?.length ?? 0} student(s) on ${body?.attendance_date}`;
  }
  if (path === "/feeding") {
    return `Feeding money — GHS ${body?.amount ?? "?"}`;
  }
  if (path === "/fees/payments") {
    return `Fee payment — GHS ${body?.amount ?? "?"}`;
  }
  if (path.startsWith("/students") && path.includes("/guardians") && method === "POST") {
    return "Link guardian to student";
  }
  if (path === "/students" && method === "POST") {
    return `New student — ${body?.full_name ?? ""}`;
  }
  if (path === "/guardians" && method === "POST") {
    return `New guardian — ${body?.full_name ?? ""}`;
  }
  if (method === "DELETE") {
    return `Delete ${path}`;
  }
  return `${method} ${path}`;
}

/**
 * Queues a mutation for later sync and returns an optimistic placeholder so
 * the calling page can update its UI immediately, without waiting for a
 * connection.
 */
export async function queueMutation<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const clientId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // Attach client_id to the body where the backend knows how to dedupe on
  // it (currently fee payments) — harmless extra field everywhere else.
  const bodyWithClientId =
    body && typeof body === "object" ? { ...(body as object), client_id: clientId } : body;

  const item: OutboxItem = {
    id: clientId,
    method,
    path,
    body: bodyWithClientId,
    description: describeMutation(method, path, body),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await addToOutbox(item);

  return buildOptimisticResult<T>(path, clientId, body);
}

function buildOptimisticResult<T>(path: string, clientId: string, body: any): T {
  const offlineId = `offline-${clientId}`;

  // The bulk attendance endpoint returns an ARRAY of records, one per
  // student, so its optimistic placeholder needs to match that shape
  // instead of the usual single-object merge.
  if (path === "/attendance/mark" && body?.records) {
    const records = (body.records as any[]).map((r, i) => ({
      id: `${offlineId}-${i}`,
      student_id: r.student_id,
      class_id: body.class_id,
      attendance_date: body.attendance_date,
      status: r.status,
      note: r.note ?? null,
      _offline: true,
    }));
    return records as T;
  }

  if (path === "/fees/payments") {
    return {
      id: offlineId,
      ...(typeof body === "object" && body ? body : {}),
      paid_at: new Date().toISOString(),
      _offline: true,
    } as T;
  }

  return {
    id: offlineId,
    ...(typeof body === "object" && body ? body : {}),
    _offline: true,
  } as T;
}
