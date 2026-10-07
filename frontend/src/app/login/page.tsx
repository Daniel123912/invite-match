"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { api, setAuth, TokenResponse } from "@/lib/api";

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
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Link href="/" className="muted mb-6 text-sm">
        ← На главную
      </Link>
      <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-sora)" }}>
        Вход
      </h1>
      <form onSubmit={onSubmit} className="panel mt-6 flex flex-col gap-4">
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
        <button className="btn btn-primary" disabled={loading || pending}>
          {loading || pending ? "Входим…" : "Войти"}
        </button>
      </form>
      <p className="muted mt-4 text-sm">
        Нет аккаунта? <Link href="/register">Регистрация</Link>
      </p>
    </main>
  );
}
