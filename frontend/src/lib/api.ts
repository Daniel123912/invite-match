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

/** Человекочитаемое сообщение об ошибке API */
export function formatApiError(err: unknown, fallback = "Что-то пошло не так"): string {
  if (!(err instanceof Error) || !err.message) return fallback;
  const raw = err.message.trim();
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => (typeof x === "object" && x && "msg" in x ? String(x.msg) : String(x)))
        .join("; ");
    }
    if (typeof parsed === "object" && parsed && "msg" in parsed) {
      return String((parsed as { msg: unknown }).msg);
    }
  } catch {
    /* not JSON */
  }

  const map: Record<string, string> = {
    "Not Found": "Ресурс не найден",
    Unauthorized: "Нужно войти заново",
    Forbidden: "Нет доступа",
    "Internal Server Error": "Ошибка сервера — попробуйте позже",
    "Failed to fetch": "Нет связи с сервером. Проверьте, что API запущен.",
  };
  if (map[raw]) return map[raw];
  if (raw.includes("Failed to fetch") || raw.includes("NetworkError")) {
    return "Нет связи с сервером. Проверьте, что API запущен.";
  }
  return raw;
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

async function parseError(res: Response): Promise<string> {
  let detail: unknown = res.statusText;
  try {
    const err = await res.json();
    detail = err.detail ?? err;
  } catch {
    /* ignore */
  }
  if (typeof detail === "string") return detail;
  return JSON.stringify(detail);
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined | null = options.body as BodyInit | null | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.form && isPlainObject(options.body)) {
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

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers, body });
  } catch {
    throw new Error("Failed to fetch");
  }

  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Failed to fetch");
  }

  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res;
}

export { API_URL };
