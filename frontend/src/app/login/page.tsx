"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";
import {
  api,
  cabinetPath,
  formatApiError,
  isAuthenticated,
  setAuth,
  TokenResponse,
} from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("candidate@demo.ru");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!isAuthenticated()) return;
    const path = cabinetPath();
    if (path) router.replace(path);
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<TokenResponse>("/api/auth/login", {
        method: "POST",
        form: true,
        body: { username: email, password },
      });
      setAuth(data);
      startTransition(() => {
        router.push(data.role === "employer" ? "/employer" : "/candidate");
      });
    } catch (err) {
      setError(formatApiError(err, "Ошибка входа"));
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

        <nav className="hidden md:flex items-center gap-2 text-sm font-semibold text-[#6B7280]">
          <Link
            href="/register?role=candidate"
            className="bg-[#F3F4F6] px-4 py-2 rounded-full hover:bg-[#E5E7EB] hover:text-[#1A1A1A] transition-colors"
          >
            Кандидатам
          </Link>
          <Link
            href="/register?role=employer"
            className="bg-[#F3F4F6] px-4 py-2 rounded-full hover:bg-[#E5E7EB] hover:text-[#1A1A1A] transition-colors"
          >
            Работодателям
          </Link>
          <Link href="/about" className="px-3 py-2 hover:text-[#1A1A1A] transition-colors">
            О платформе
          </Link>
        </nav>

        <div className="flex items-center gap-3 text-sm font-semibold">
          <Link
            href="/register"
            className="hidden sm:block text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
          >
            Регистрация
          </Link>
          <span className="bg-[#8B7CF6] text-white px-6 py-2.5 rounded-full">Войти</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center pb-16">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-[420px] bg-[#F3F3F3] rounded-[32px] px-8 py-10 md:px-12 md:py-12 flex flex-col items-stretch gap-5"
        >
          <h1 className="text-center text-xl md:text-2xl font-bold tracking-wide uppercase text-[#1A1A1A]">
            Авторизация
          </h1>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-2xl bg-[#D1D5DB] px-5 py-3.5 text-[#1A1A1A] placeholder:text-[#6B7280] outline-none focus:ring-2 focus:ring-[#8B7CF6]/40 transition"
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            placeholder="Пароль"
            autoComplete="current-password"
            className="w-full rounded-2xl bg-[#D1D5DB] px-5 py-3.5 text-[#1A1A1A] placeholder:text-[#6B7280] outline-none focus:ring-2 focus:ring-[#8B7CF6]/40 transition"
          />

          <div className="flex items-center justify-between gap-3 text-sm text-[#4B5563]">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="size-4 rounded border-[#9CA3AF] accent-[#8B7CF6]"
              />
              <span>Запомнить меня</span>
            </label>
            <Link
              href="/forgot-password"
              className="hover:text-[#1A1A1A] transition-colors"
            >
              Забыли пароль?
            </Link>
          </div>

          {error && <p className="text-sm text-center text-[var(--danger)]">{error}</p>}

          <button
            type="submit"
            disabled={loading || pending}
            className="w-full rounded-2xl bg-[#8B7CF6] hover:bg-[#7A6BE5] disabled:opacity-60 text-[#1A1A1A] font-bold uppercase tracking-wide py-3.5 transition-colors"
          >
            {loading || pending ? "Входим…" : "Войти"}
          </button>

          <p className="text-center text-sm text-[#4B5563]">
            <Link href="/register" className="hover:text-[#1A1A1A] transition-colors">
              Нет аккаунта?
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
