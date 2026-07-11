import { supabase } from "./supabaseClient";
import { getCachedGet, setCachedGet } from "./offline/db";
import { queueMutation } from "./offline/queue";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Endpoints that genuinely require a live connection — sending an SMS/email
// can't be queued and "sent later" without surprising staff, so broadcasts
// are excluded from offline queueing and fail clearly instead.
function requiresLiveConnection(path: string): boolean {
  return path.startsWith("/broadcasts");
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function doFetch<T>(path: string, options: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let detail = "Something went wrong. Please try again.";
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore parse errors */
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isMutation = method !== "GET";
  const canQueue = isMutation && !requiresLiveConnection(path);

  // Offline and this is something we can queue — skip the network attempt
  // entirely and go straight to the outbox.
  if (canQueue && isOffline()) {
    const body = options.body ? JSON.parse(options.body as string) : undefined;
    return queueMutation<T>(method as "POST" | "PATCH" | "DELETE", path, body);
  }

  try {
    const result = await doFetch<T>(path, options);
    if (!isMutation) {
      // Cache every successful read so it's available offline later.
      setCachedGet(path, result).catch(() => {});
    }
    return result;
  } catch (err) {
    if (err instanceof ApiError) {
      // A real response from a reachable server (validation error, 403,
      // 404, etc.) — never queue or fall back for these, just surface it.
      throw err;
    }

    // fetch() itself threw, meaning the request never reached the server
    // (no connection, DNS failure, backend unreachable).
    if (canQueue) {
      const body = options.body ? JSON.parse(options.body as string) : undefined;
      return queueMutation<T>(method as "POST" | "PATCH" | "DELETE", path, body);
    }
    if (!isMutation) {
      const cached = await getCachedGet<T>(path);
      if (cached !== undefined) return cached;
      throw new ApiError(
        "You're offline and this hasn't been loaded before, so there's nothing to show yet.",
        0
      );
    }
    if (isMutation && requiresLiveConnection(path)) {
      throw new ApiError(
        "This needs an internet connection — it can't be queued for later.",
        0
      );
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { ApiError };
