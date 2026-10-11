"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, formatApiError } from "@/lib/api";

interface Profile {
  fsp_id?: string;
  privacy_public: boolean;
  consent_152fz: boolean;
  consent_152fz_at?: string | null;
  has_fsp_history: boolean;
  fsp_score: number;
}

export default function SettingsPage() {
  const [form, setForm] = useState<Profile | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Profile>("/api/candidate/profile")
      .then((p) =>
        setForm({
          fsp_id: p.fsp_id,
          privacy_public: p.privacy_public,
          consent_152fz: p.consent_152fz,
          consent_152fz_at: p.consent_152fz_at,
          has_fsp_history: p.has_fsp_history,
          fsp_score: p.fsp_score,
        }),
      )
      .catch((e) => setError(formatApiError(e)));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setMsg("");
    setError("");
    setSaving(true);
    try {
      const updated = await api<Profile>("/api/candidate/profile", {
        method: "PATCH",
        body: {
          fsp_id: form.fsp_id,
          privacy_public: form.privacy_public,
          consent_152fz: form.consent_152fz,
        },
      });
      setForm({
        fsp_id: updated.fsp_id,
        privacy_public: updated.privacy_public,
        consent_152fz: updated.consent_152fz,
        consent_152fz_at: updated.consent_152fz_at,
        has_fsp_history: updated.has_fsp_history,
        fsp_score: updated.fsp_score,
      });
      setMsg("Сохранено");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!form && !error) {
    return (
      <div className="panel empty-state">
        <p className="muted">Загрузка настроек…</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="panel empty-state">
        <p className="font-semibold text-[var(--danger)]">Не удалось загрузить</p>
        <p className="muted text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="section-title text-xl">Настройки</h2>
        <p className="muted mt-1 text-sm">
          Приватность, согласие 152-ФЗ и привязка FSP ID
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        <section className="panel grid gap-4 md:grid-cols-2">
          <h3 className="md:col-span-2 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
            ФСП и приватность
          </h3>
          <div className="field">
            <label>FSP ID</label>
            <input
              value={form.fsp_id || ""}
              onChange={(e) => setForm({ ...form, fsp_id: e.target.value })}
              placeholder="FSP-1001"
            />
            <p className="muted mt-1 text-xs">
              Демо: FSP-1001, FSP-1002, FSP-2001. Пустой ID — «истории нет».
            </p>
          </div>
          <div className="flex flex-col justify-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.privacy_public}
                onChange={(e) => setForm({ ...form, privacy_public: e.target.checked })}
              />
              <span>
                <span className="font-semibold">Профиль виден в подборке</span>
                <span className="muted block text-xs">Работодатели видят категорию, не контакты</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.consent_152fz}
                onChange={(e) => setForm({ ...form, consent_152fz: e.target.checked })}
              />
              <span>
                <span className="font-semibold">Согласие на обработку ПДн (152-ФЗ)</span>
                {form.consent_152fz_at ? (
                  <span className="muted block text-xs">
                    От: {new Date(form.consent_152fz_at).toLocaleString("ru-RU")}
                  </span>
                ) : (
                  <span className="block text-xs text-[var(--danger)]">
                    Без согласия опрос и тест недоступны
                  </span>
                )}
              </span>
            </label>
            <p className="muted text-xs">
              ФСП: {form.has_fsp_history ? `${form.fsp_score} баллов` : "истории нет"}
            </p>
          </div>
        </section>

        {(msg || error) && (
          <div className="panel !py-3">
            {msg && <p className="text-sm font-semibold text-[var(--ok)]">{msg}</p>}
            {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
          <Link href="/candidate/profile" className="btn btn-ghost">
            К профилю
          </Link>
        </div>
      </form>
    </div>
  );
}
