"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { api, formatApiError, setAuth, TokenResponse } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("candidate@demo.ru");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

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
    <main className="auth-shell">
      <div className="auth-card">
        <Link href="/" className="cabinet-brand">
          FSP Match
        </Link>
        <h1 className="cabinet-title mt-4">Вход</h1>
        <p className="muted mt-2 text-sm">Войдите, чтобы открыть кабинет кандидата или работодателя.</p>

        <form onSubmit={onSubmit} className="panel panel-solid mt-7 flex flex-col gap-4">
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button className="btn btn-primary w-full" disabled={loading || pending}>
            {loading || pending ? "Входим…" : "Войти"}
          </button>
        </form>

        <p className="muted mt-5 text-sm">
          Нет аккаунта?{" "}
          <Link href="/register" className="link-quiet">
            Регистрация
          </Link>
        </p>
      </div>
    </main>
  );
}
