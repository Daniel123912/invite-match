"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api, formatApiError } from "@/lib/api";

type ForgotResponse = {
  message: string;
  email: string;
  temporary_password?: string | null;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setDone(false);
    setTempPassword(null);
    try {
      const data = await api<ForgotResponse>("/api/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });
      setMessage(data.message);
      setTempPassword(data.temporary_password ?? null);
      setDone(true);
    } catch (err) {
      setError(formatApiError(err, "Не удалось сбросить пароль"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col max-w-[1200px] mx-auto px-4 md:px-8 py-6 bg-white">
      <header className="flex items-center justify-between mb-10">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="ФСП"
            width={269}
            height={97}
            className="h-10 w-auto"
          />
        </Link>

        <div className="flex items-center gap-3 text-sm font-semibold">
          <Link
            href="/register"
            className="hidden sm:block text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
          >
            Регистрация
          </Link>
          <Link
            href="/login"
            className="bg-[#8B7CF6] text-white px-6 py-2.5 rounded-full hover:bg-[#7A6BE5] transition-colors"
          >
            Войти
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center pb-16">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-[420px] bg-[#F3F3F3] rounded-[32px] px-8 py-10 md:px-12 md:py-12 flex flex-col items-stretch gap-5"
        >
          <h1 className="text-center text-xl md:text-2xl font-bold tracking-wide uppercase text-[#1A1A1A]">
            Восстановление пароля
          </h1>

          <p className="text-center text-sm text-[#4B5563]">
            Укажите email аккаунта — мы сгенерируем новый пароль.
          </p>

          {!done ? (
            <>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="Email"
                autoComplete="email"
                className="w-full rounded-2xl bg-[#D1D5DB] px-5 py-3.5 text-[#1A1A1A] placeholder:text-[#6B7280] outline-none focus:ring-2 focus:ring-[#8B7CF6]/40 transition"
              />

              {error && <p className="text-sm text-center text-[var(--danger)]">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#8B7CF6] hover:bg-[#7A6BE5] disabled:opacity-60 text-[#1A1A1A] font-bold uppercase tracking-wide py-3.5 transition-colors"
              >
                {loading ? "Отправляем…" : "Сбросить пароль"}
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-4 text-sm text-[#1A1A1A]">
              <p className="text-center text-[#4B5563]">{message}</p>
              {tempPassword && (
                <div className="rounded-2xl bg-[#D1D5DB] px-5 py-4 text-center">
                  <p className="text-[#4B5563] mb-2">
                    Локальный режим (без почты) — ваш новый пароль:
                  </p>
                  <p className="font-mono text-lg font-bold break-all select-all">
                    {tempPassword}
                  </p>
                  <p className="text-[#6B7280] mt-2 text-xs">
                    Сохраните его и войдите. Старый пароль больше не действует.
                  </p>
                </div>
              )}
              <Link
                href="/login"
                className="w-full text-center rounded-2xl bg-[#8B7CF6] hover:bg-[#7A6BE5] text-[#1A1A1A] font-bold uppercase tracking-wide py-3.5 transition-colors"
              >
                Перейти ко входу
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDone(false);
                  setMessage("");
                  setTempPassword(null);
                }}
                className="text-center text-[#4B5563] hover:text-[#1A1A1A] transition-colors"
              >
                Указать другой email
              </button>
            </div>
          )}

          <p className="text-center text-sm text-[#4B5563]">
            <Link href="/login" className="hover:text-[#1A1A1A] transition-colors">
              Вернуться ко входу
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
