"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { api, formatApiError, setAuth, TokenResponse, API_URL } from "@/lib/api";

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  consent?: string;
};

function validateLocal(fullName: string, email: string, password: string, consent: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (fullName.trim().length < 2) errors.fullName = "Имя — минимум 2 символа";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Некорректный email";
  if (password.length < 8) errors.password = "Пароль не короче 8 символов";
  else if (!/[A-Za-zА-Яа-я]/.test(password)) errors.password = "Нужна хотя бы одна буква";
  else if (!/\d/.test(password)) errors.password = "Нужна хотя бы одна цифра";
  if (!consent) errors.consent = "Нужно согласие на обработку ПДн (152-ФЗ)";
  return errors;
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"candidate" | "employer">("candidate");
  const [consent, setConsent] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [parentalConsent, setParentalConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [emailStatus, setEmailStatus] = useState<"" | "checking" | "free" | "taken">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  // Живая проверка email без перезагрузки страницы
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailStatus("");
      return;
    }
    setEmailStatus("checking");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/auth/check-email?email=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) {
          setEmailStatus("");
          return;
        }
        const data = (await res.json()) as { available: boolean };
        setEmailStatus(data.available ? "free" : "taken");
        setFieldErrors((prev) => ({
          ...prev,
          email: data.available ? undefined : "Email уже зарегистрирован",
        }));
      } catch {
        setEmailStatus("");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [email]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const local = validateLocal(fullName, email, password, consent);
    if (emailStatus === "taken") local.email = "Email уже зарегистрирован";
    setFieldErrors(local);
    if (Object.keys(local).length > 0 || emailStatus === "taken" || emailStatus === "checking") {
      return;
    }
    setLoading(true);
    try {
      const data = await api<TokenResponse>("/api/auth/register", {
        method: "POST",
        body: {
          email: email.trim(),
          password,
          role,
          full_name: fullName.trim(),
          consent_152fz: true,
          ...(role === "candidate" && birthDate ? { birth_date: birthDate, parental_consent: parentalConsent } : {}),
        },
      });
      setAuth(data);
      // client-side переход без hard reload
      startTransition(() => {
        router.push(data.role === "employer" ? "/employer" : "/candidate");
      });
    } catch (err) {
      setError(formatApiError(err, "Ошибка регистрации"));
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || pending;

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link href="/" className="cabinet-brand">
          FSP Match
        </Link>
        <h1 className="cabinet-title mt-4">Регистрация</h1>
        <p className="muted mt-2 text-sm">Создайте аккаунт кандидата или работодателя.</p>
        <form onSubmit={onSubmit} className="panel panel-solid mt-7 flex flex-col gap-4" noValidate>
          <div className="field">
            <label>Имя</label>
            <input
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setFieldErrors((p) => ({ ...p, fullName: undefined }));
              }}
              autoComplete="name"
            />
            {fieldErrors.fullName && (
              <p className="text-sm text-[var(--danger)]">{fieldErrors.fullName}</p>
            )}
          </div>
          <div className="field">
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((p) => ({ ...p, email: undefined }));
              }}
              type="email"
              autoComplete="email"
            />
            {emailStatus === "checking" && <p className="muted text-xs">Проверяем email…</p>}
            {emailStatus === "free" && !fieldErrors.email && (
              <p className="text-xs text-[var(--ok)]">Email свободен</p>
            )}
            {fieldErrors.email && (
              <p className="text-sm text-[var(--danger)]">{fieldErrors.email}</p>
            )}
          </div>
          <div className="field">
            <label>Пароль</label>
            <input
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              type="password"
              autoComplete="new-password"
            />
            <p className="muted text-xs">Минимум 8 символов, буква и цифра</p>
            {fieldErrors.password && (
              <p className="text-sm text-[var(--danger)]">{fieldErrors.password}</p>
            )}
          </div>
          {role === "candidate" && (
            <>
              <div className="field">
                <label>Дата рождения (для 16–17 лет)</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={parentalConsent}
                  onChange={(e) => setParentalConsent(e.target.checked)}
                />
                <span>Согласие родителей на обработку ПДн (обязательно для 16–17 лет)</span>
              </label>
            </>
          )}
          <div className="field">
            <label>Роль</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "candidate" | "employer")}>
              <option value="candidate">Кандидат</option>
              <option value="employer">Работодатель</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setFieldErrors((p) => ({ ...p, consent: undefined }));
              }}
              className="mt-1"
            />
            <span>
              Даю согласие на обработку персональных данных в соответствии с 152-ФЗ. Контакты
              кандидата открываются работодателю только после принятия приглашения.
            </span>
          </label>
          {fieldErrors.consent && (
            <p className="text-sm text-[var(--danger)]">{fieldErrors.consent}</p>
          )}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            className="btn btn-primary w-full"
            disabled={busy || emailStatus === "taken" || emailStatus === "checking"}
          >
            {busy ? "Создаём…" : "Создать аккаунт"}
          </button>
        </form>
        <p className="muted mt-5 text-sm">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="link-quiet">
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}
