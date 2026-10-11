"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState, useTransition } from "react";
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

function roleFromQuery(value: string | null): "candidate" | "employer" {
  return value === "employer" ? "employer" : "candidate";
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"candidate" | "employer">(() =>
    roleFromQuery(searchParams.get("role")),
  );
  const [consent, setConsent] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [parentalConsent, setParentalConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [emailStatus, setEmailStatus] = useState<"" | "checking" | "free" | "taken">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmToken, setConfirmToken] = useState("");
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  useEffect(() => {
    setRole(roleFromQuery(searchParams.get("role")));
  }, [searchParams]);

  // Вычисляем валидность email вне эффекта (derived state)
  const trimmedEmail = email.trim().toLowerCase();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  // Живая проверка email без перезагрузки страницы.
  // Важно: НИ ОДИН setState не вызывается синхронно в теле эффекта —
  // всё происходит внутри setTimeout или после await fetch.
  useEffect(() => {
    if (!isEmailValid) {
      // Отложенный сброс статуса — не синхронно в effect
      const resetTimer = setTimeout(() => {
        setEmailStatus("");
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    let cancelled = false;

    const debounceTimer = setTimeout(async () => {
      if (cancelled) return;
      setEmailStatus("checking");

      try {
        const res = await fetch(
          `${API_URL}/api/auth/check-email?email=${encodeURIComponent(trimmedEmail)}`,
        );
        if (cancelled) return;

        if (!res.ok) {
          setEmailStatus("");
          return;
        }

        const data = (await res.json()) as { available: boolean };
        if (cancelled) return;

        setEmailStatus(data.available ? "free" : "taken");
        setFieldErrors((prev) => ({
          ...prev,
          email: data.available ? undefined : "Email уже зарегистрирован",
        }));
      } catch {
        if (!cancelled) setEmailStatus("");
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [trimmedEmail, isEmailValid]);

  async function confirmAndEnter(token: string) {
    const data = await api<TokenResponse>("/api/auth/confirm-email", {
      method: "POST",
      body: { token },
    });
    setAuth(data);
    startTransition(() => {
      router.push(data.role === "employer" ? "/employer" : "/candidate");
    });
  }

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
      const data = await api<{
        message: string;
        email: string;
        email_confirm_token?: string | null;
      }>("/api/auth/register", {
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
      if (data.email_confirm_token) {
        setConfirmToken(data.email_confirm_token);
        setAwaitingConfirm(true);
        await confirmAndEnter(data.email_confirm_token);
      } else {
        setAwaitingConfirm(true);
        setError("Аккаунт создан. Подтвердите email токеном из письма (или /api/auth/resend-confirmation).");
      }
    } catch (err) {
      setError(formatApiError(err, "Ошибка регистрации"));
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmManual(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await confirmAndEnter(confirmToken.trim());
    } catch (err) {
      setError(formatApiError(err, "Не удалось подтвердить email"));
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || pending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F9F9] px-4 py-12">
      {/* Карточка формы */}
      <div className="w-full max-w-[500px] bg-[#F3F3F3] rounded-[40px] p-8 md:p-10 flex flex-col items-center shadow-sm">

        {/* Заголовок */}
        <h1 className="text-2xl md:text-3xl font-semibold text-[#1A1A1A] mb-2 tracking-wide text-center mt-2">
          РЕГИСТРАЦИЯ
        </h1>
        <p className="text-[#6B7280] text-sm mb-8 text-center">
          Создайте аккаунт кандидата или работодателя.
        </p>

        {/* Форма подтверждения токена */}
        {awaitingConfirm && (
          <form onSubmit={onConfirmManual} className="w-full flex flex-col gap-4">
            <p className="text-sm text-[#1A1A1A]">
              Подтвердите email токеном (в демо он приходит в ответе регистрации).
            </p>
            <div className="w-full">
              <input
                value={confirmToken}
                onChange={(e) => setConfirmToken(e.target.value)}
                placeholder="Токен подтверждения"
                className="w-full bg-[#D9D9D9] text-[#1A1A1A] placeholder-[#6B7280] px-6 py-4 rounded-full text-base outline-none focus:ring-2 focus:ring-[#8B7CF6] transition-all"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              className="w-full bg-[#8B7CF6] hover:bg-[#7A6BE5] text-white py-4 rounded-full text-base font-semibold tracking-wider transition-colors mt-2 disabled:opacity-50"
              disabled={busy || !confirmToken.trim()}
            >
              {busy ? "Подтверждаем…" : "Подтвердить и войти"}
            </button>
          </form>
        )}

        {/* Основная форма регистрации */}
        {!awaitingConfirm && (
          <form onSubmit={onSubmit} className="w-full flex flex-col gap-4" noValidate>

            {/* Имя */}
            <div className="w-full">
              <input
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setFieldErrors((p) => ({ ...p, fullName: undefined }));
                }}
                placeholder="Имя"
                autoComplete="name"
                className="w-full bg-[#D9D9D9] text-[#1A1A1A] placeholder-[#6B7280] px-6 py-4 rounded-full text-base outline-none focus:ring-2 focus:ring-[#8B7CF6] transition-all"
              />
              {fieldErrors.fullName && (
                <p className="text-sm text-red-500 mt-1 px-2">{fieldErrors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="w-full">
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldErrors((p) => ({ ...p, email: undefined }));
                }}
                type="email"
                placeholder="Email"
                autoComplete="email"
                className="w-full bg-[#D9D9D9] text-[#1A1A1A] placeholder-[#6B7280] px-6 py-4 rounded-full text-base outline-none focus:ring-2 focus:ring-[#8B7CF6] transition-all"
              />
              {emailStatus === "checking" && (
                <p className="text-xs text-[#6B7280] mt-1 px-2">Проверяем email…</p>
              )}
              {emailStatus === "free" && !fieldErrors.email && (
                <p className="text-xs text-green-600 mt-1 px-2">Email свободен</p>
              )}
              {fieldErrors.email && (
                <p className="text-sm text-red-500 mt-1 px-2">{fieldErrors.email}</p>
              )}
            </div>

            {/* Пароль */}
            <div className="w-full">
              <input
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((p) => ({ ...p, password: undefined }));
                }}
                type="password"
                placeholder="Пароль"
                autoComplete="new-password"
                className="w-full bg-[#D9D9D9] text-[#1A1A1A] placeholder-[#6B7280] px-6 py-4 rounded-full text-base outline-none focus:ring-2 focus:ring-[#8B7CF6] transition-all"
              />
              <p className="text-xs text-[#6B7280] mt-1 px-2">Минимум 8 символов, буква и цифра</p>
              {fieldErrors.password && (
                <p className="text-sm text-red-500 mt-1 px-2">{fieldErrors.password}</p>
              )}
            </div>

            {/* Дата рождения (только для кандидата) */}
            {role === "candidate" && (
              <>
                <div className="w-full">
                  <label className="text-sm text-[#6B7280] px-2 block mb-1">
                    Дата рождения (для 16–17 лет)
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-[#D9D9D9] text-[#1A1A1A] px-6 py-4 rounded-full text-base outline-none focus:ring-2 focus:ring-[#8B7CF6] transition-all"
                  />
                </div>
                <label className="flex items-start gap-3 text-sm cursor-pointer px-2">
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 rounded border-2 border-gray-500 text-[#8B7CF6] focus:ring-[#8B7CF6] accent-[#8B7CF6]"
                    checked={parentalConsent}
                    onChange={(e) => setParentalConsent(e.target.checked)}
                  />
                  <span className="text-[#1A1A1A]">
                    Согласие родителей на обработку ПДн (обязательно для 16–17 лет)
                  </span>
                </label>
              </>
            )}

            {/* Роль */}
            <div className="w-full">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "candidate" | "employer")}
                className="w-full bg-[#D9D9D9] text-[#1A1A1A] px-6 py-4 rounded-full text-base outline-none focus:ring-2 focus:ring-[#8B7CF6] transition-all appearance-none cursor-pointer"
              >
                <option value="candidate">Кандидат</option>
                <option value="employer">Работодатель</option>
              </select>
            </div>

            {/* Согласие на обработку ПДн */}
            <label className="flex items-start gap-3 text-sm cursor-pointer px-2">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setFieldErrors((p) => ({ ...p, consent: undefined }));
                }}
                className="mt-1 w-4 h-4 rounded border-2 border-gray-500 text-[#8B7CF6] focus:ring-[#8B7CF6] accent-[#8B7CF6]"
              />
              <span className="text-[#1A1A1A]">
                Даю согласие на обработку персональных данных в соответствии с 152-ФЗ. Контакты
                кандидата открываются работодателю только после принятия приглашения.
              </span>
            </label>
            {fieldErrors.consent && (
              <p className="text-sm text-red-500 px-2">{fieldErrors.consent}</p>
            )}

            {error && <p className="text-sm text-red-500 px-2">{error}</p>}

            {/* Кнопка */}
            <button
              className="w-full bg-[#8B7CF6] hover:bg-[#7A6BE5] text-white py-4 rounded-full text-base font-semibold tracking-wider transition-colors mt-2 disabled:opacity-50"
              disabled={busy || emailStatus === "taken" || emailStatus === "checking"}
            >
              {busy ? "Создаём…" : "СОЗДАТЬ АККАУНТ"}
            </button>
          </form>
        )}

        {/* Ссылка на вход */}
        <p className="mt-6 text-sm text-[#1A1A1A] font-medium">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-[#8B7CF6] hover:underline">
            Войти
          </Link>
        </p>

      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F9F9F9] px-4 py-12">
          <p className="text-[#6B7280] text-sm">Загрузка…</p>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}