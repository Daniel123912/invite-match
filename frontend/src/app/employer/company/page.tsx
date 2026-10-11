"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { INDUSTRIES } from "@/lib/labels";

interface Company {
  id?: number;
  name: string;
  description?: string;
  website?: string;
  industry?: string;
  city?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_telegram?: string;
  verified?: boolean;
  verification_note?: string;
}

export default function CompanyPage() {
  const [form, setForm] = useState<Company>({
    name: "",
    description: "",
    website: "",
    industry: "it",
    city: "",
    contact_email: "",
    contact_phone: "",
    contact_telegram: "",
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Company | null>("/api/employer/company")
      .then((c) => {
        if (c) setForm(c);
      })
      .catch((e) => setError(formatApiError(e, "Не удалось загрузить компанию")))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const saved = await api<Company>("/api/employer/company", {
        method: "PUT",
        body: form,
      });
      setForm(saved);
      setMsg("Сохранено");
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function requestVerify() {
    setError("");
    setMsg("");
    try {
      await api("/api/employer/company/verify-request", { method: "POST" });
      setMsg("Заявка на верификацию отправлена");
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  if (loading) {
    return (
      <div className="panel empty-state">
        <p className="muted">Загрузка…</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel grid max-w-2xl gap-4">
      <div>
        <h2 className="section-title text-xl">Профиль компании</h2>
        <p className="muted mt-1 text-sm">Нужен, чтобы отправлять приглашения кандидатам</p>
      </div>
      <div className="field">
        <label>Название</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Сайт</label>
        <input
          value={form.website || ""}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Город</label>
        <input
          value={form.city || ""}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Отрасль</label>
        <select
          value={form.industry || "it"}
          onChange={(e) => setForm({ ...form, industry: e.target.value })}
        >
          {INDUSTRIES.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Описание (обязательно, мин. 20 символов)</label>
        <textarea
          rows={4}
          required
          minLength={20}
          value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Чем занимается компания"
        />
      </div>
      <div className="field">
        <label>Контактный email</label>
        <input
          type="email"
          value={form.contact_email || ""}
          onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          placeholder="hr@company.ru"
        />
      </div>
      <div className="field">
        <label>Контактный телефон</label>
        <input
          value={form.contact_phone || ""}
          onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
          placeholder="+7…"
        />
      </div>
      <div className="field">
        <label>Telegram</label>
        <input
          value={form.contact_telegram || ""}
          onChange={(e) => setForm({ ...form, contact_telegram: e.target.value })}
          placeholder="@hr_team"
        />
      </div>
      <p className="muted text-xs">Нужен хотя бы один способ связи — он попадёт в приглашения</p>
      {form.verified && <p className="text-sm font-semibold text-[var(--ok)]">Компания верифицирована</p>}
      {form.verification_note && <p className="muted text-xs">{form.verification_note}</p>}
      <button type="button" className="btn btn-ghost w-fit" onClick={requestVerify}>
        Запросить проверку компании
      </button>
      {msg && <p className="text-sm font-semibold text-[var(--ok)]">{msg}</p>}
      {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary">Сохранить</button>
        <Link href="/employer/needs" className="btn btn-ghost">
          Далее: потребность →
        </Link>
      </div>
    </form>
  );
}
