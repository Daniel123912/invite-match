"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Profile {
  full_name: string;
  phone?: string;
  telegram?: string;
  city?: string;
  about?: string;
  resume_text?: string;
  stack?: string;
  fsp_id?: string;
  privacy_public: boolean;
  consent_152fz: boolean;
  consent_152fz_at?: string | null;
  has_fsp_history: boolean;
  fsp_score: number;
}

export default function ProfilePage() {
  const [form, setForm] = useState<Profile | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Profile>("/api/candidate/profile").then(setForm).catch((e) => setError(e.message));
  }, []);

  async function save(next: Profile) {
    setMsg("");
    setError("");
    setSaving(true);
    try {
      const updated = await api<Profile>("/api/candidate/profile", {
        method: "PATCH",
        body: next,
      });
      setForm(updated);
      setMsg("Сохранено");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    await save(form);
  }

  if (!form) return <p className="muted">Загрузка…</p>;

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, [key]: value };
      if (key === "consent_152fz" || key === "privacy_public") {
        void save(next);
      }
      return next;
    });
  }

  return (
    <form onSubmit={onSubmit} className="panel grid gap-4 md:col-span-2 md:grid-cols-2">
      <div className="field">
        <label>ФИО</label>
        <input value={form.full_name || ""} onChange={(e) => set("full_name", e.target.value)} />
      </div>
      <div className="field">
        <label>Город</label>
        <input value={form.city || ""} onChange={(e) => set("city", e.target.value)} />
      </div>
      <div className="field">
        <label>Телефон</label>
        <input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <div className="field">
        <label>Telegram</label>
        <input value={form.telegram || ""} onChange={(e) => set("telegram", e.target.value)} />
      </div>
      <div className="field md:col-span-2">
        <label>Стек (через запятую)</label>
        <input value={form.stack || ""} onChange={(e) => set("stack", e.target.value)} />
      </div>
      <div className="field md:col-span-2">
        <label>О себе</label>
        <textarea rows={3} value={form.about || ""} onChange={(e) => set("about", e.target.value)} />
      </div>
      <div className="field md:col-span-2">
        <label>Резюме (текст)</label>
        <textarea
          rows={4}
          value={form.resume_text || ""}
          onChange={(e) => set("resume_text", e.target.value)}
        />
      </div>
      <div className="field">
        <label>FSP ID (заглушка)</label>
        <input
          value={form.fsp_id || ""}
          onChange={(e) => set("fsp_id", e.target.value)}
          placeholder="FSP-1001"
        />
      </div>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.privacy_public}
            onChange={(e) => set("privacy_public", e.target.checked)}
          />
          Профиль виден в подборке
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.consent_152fz}
            onChange={(e) => set("consent_152fz", e.target.checked)}
          />
          Согласие на обработку ПДн (152-ФЗ)
        </label>
        {form.consent_152fz_at ? (
          <p className="muted text-xs">
            Согласие от: {new Date(form.consent_152fz_at).toLocaleString("ru-RU")}
          </p>
        ) : (
          <p className="text-xs text-[var(--danger)]">
            Без согласия профиль не попадёт в подборку, опрос и тест недоступны
          </p>
        )}
        <p className="muted">
          ФСП: {form.has_fsp_history ? `${form.fsp_score} баллов` : "истории нет"}
        </p>
      </div>
      {msg && <p className="text-[var(--ok)] md:col-span-2">{msg}</p>}
      {error && <p className="text-[var(--danger)] md:col-span-2">{error}</p>}
      <button className="btn btn-primary md:col-span-2" disabled={saving}>
        {saving ? "Сохраняем…" : "Сохранить"}
      </button>
    </form>
  );
}
