const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Role = "candidate" | "employer" | "admin";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: Role;
  user_id: number;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setAuth(data: TokenResponse) {
  localStorage.setItem("token", data.access_token);
  localStorage.setItem("role", data.role);
  localStorage.setItem("user_id", String(data.user_id));
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("user_id");
}

export function getRole(): Role | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("role") as Role | null;
}

type ApiBody = BodyInit | Record<string, unknown> | null;

type ApiOptions = Omit<RequestInit, "body"> & {
  form?: boolean;
  body?: ApiBody;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof FormData) &&
    !(value instanceof URLSearchParams) &&
    !(value instanceof Blob) &&
    !(value instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(value)
  );
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined | null = options.body as BodyInit | null | undefined;
  if (options.form && isPlainObject(options.body)) {
    const fd = new URLSearchParams();
    for (const [k, v] of Object.entries(options.body)) {
      fd.set(k, String(v ?? ""));
    }
    body = fd.toString();
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  } else if (options.body != null && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, body });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || JSON.stringify(err);
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export { API_URL };
