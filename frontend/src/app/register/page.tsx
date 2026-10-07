"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, setAuth, TokenResponse } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"candidate" | "employer">("candidate");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!consent) {
      setError("Нужно согласие на обработку персональных данных (152-ФЗ)");
      return;
    }
    setLoading(true);
    try {
      const data = await api<TokenResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          role,
          full_name: fullName,
          consent_152fz: true,
        }),
      });
      setAuth(data);
      router.push(data.role === "employer" ? "/employer" : "/candidate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
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
        Регистрация
      </h1>
      <form onSubmit={onSubmit} className="panel mt-6 flex flex-col gap-4">
        <div className="field">
          <label>Имя</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
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
            minLength={6}
            required
          />
        </div>
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
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
            required
          />
          <span>
            Даю согласие на обработку персональных данных в соответствии с 152-ФЗ.
            Контакты кандидата открываются работодателю только после принятия приглашения.
          </span>
        </label>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" disabled={loading || !consent}>
          {loading ? "Создаём…" : "Создать аккаунт"}
        </button>
      </form>
    </main>
  );
}
