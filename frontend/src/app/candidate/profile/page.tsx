"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, apiFetch, formatApiError } from "@/lib/api";

interface Profile {
  full_name: string;
  phone?: string;
  telegram?: string;
  city?: string;
  about?: string;
  resume_text?: string;
  resume_file_name?: string | null;
  resume_content_type?: string | null;
  stack?: string;
  fsp_id?: string;
  privacy_public: boolean;
  consent_152fz: boolean;
  consent_152fz_at?: string | null;
  has_fsp_history: boolean;
  fsp_score: number;
  birth_date?: string | null;
  parental_consent?: boolean;
}

function isPdfResume(mime?: string | null) {
  return mime === "application/pdf";
}

function isDocxResume(mime?: string | null) {
  return mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

export default function ProfilePage() {
  const [form, setForm] = useState<Profile | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    api<Profile>("/api/candidate/profile")
      .then(setForm)
      .catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

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
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    await save(form);
  }

  async function onResumeSelected(file: File | null) {
    if (!file || !form) return;
    setError("");
    setMsg("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const updated = await api<Profile>("/api/candidate/resume", {
        method: "POST",
        body: fd,
      });
      setForm(updated);
      setMsg("Резюме загружено");
      closePreview();
    } catch (err) {
      setError(formatApiError(err, "Ошибка загрузки"));
    } finally {
      setUploading(false);
    }
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreviewHtml(null);
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewPdfUrl(null);
  }

  async function openPreview() {
    if (!form?.resume_file_name) return;
    setError("");
    closePreview();
    setPreviewOpen(true);
    try {
      if (isPdfResume(form.resume_content_type)) {
        const res = await apiFetch("/api/candidate/resume/file");
        const blob = await res.blob();
        setPreviewPdfUrl(URL.createObjectURL(blob));
      } else if (isDocxResume(form.resume_content_type)) {
        const res = await apiFetch("/api/candidate/resume/preview");
        setPreviewHtml(await res.text());
      } else {
        throw new Error("Неизвестный формат файла");
      }
    } catch (err) {
      setPreviewOpen(false);
      setError(formatApiError(err, "Не удалось открыть файл"));
    }
  }

  async function removeResume() {
    if (!form) return;
    setError("");
    setUploading(true);
    try {
      const updated = await api<Profile>("/api/candidate/resume", { method: "DELETE" });
      setForm(updated);
      closePreview();
      setMsg("Файл резюме удалён");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setUploading(false);
    }
  }

  if (loadError) {
    return (
      <div className="panel empty-state">
        <p className="font-semibold text-[var(--danger)]">Не удалось загрузить профиль</p>
        <p className="muted text-sm">{loadError}</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="panel empty-state">
        <p className="muted">Загрузка профиля…</p>
      </div>
    );
  }

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

  const hasResumeFile = Boolean(form.resume_file_name);

  return (
    <>
      <div className="mb-4">
        <h2 className="section-title text-xl">
          Профиль
        </h2>
        <p className="muted mt-1 text-sm">
          Контакты скрыты от работодателей до принятия приглашения
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        <section className="panel grid gap-4 md:grid-cols-2">
          <h3 className="md:col-span-2 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
            Основное
          </h3>
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
            <input
              value={form.stack || ""}
              onChange={(e) => set("stack", e.target.value)}
              placeholder="Python, FastAPI, PostgreSQL"
            />
          </div>
          <div className="field md:col-span-2">
            <label>О себе</label>
            <textarea rows={3} value={form.about || ""} onChange={(e) => set("about", e.target.value)} />
          </div>
        </section>

        <section className="panel grid gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Резюме</h3>
          <div className="field">
            <label>Файл (PDF или Word)</label>
            <p className="muted mb-2 text-xs">
              Загрузите .pdf или .docx — текст извлечётся ниже. Максимум 5 МБ.
            </p>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={uploading || !form.consent_152fz}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                void onResumeSelected(f);
              }}
            />
            {!form.consent_152fz && (
              <p className="mt-1 text-xs text-[var(--danger)]">
                Для загрузки файла нужно согласие на обработку ПДн
              </p>
            )}
            {hasResumeFile && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="badge">{form.resume_file_name}</span>
                <button type="button" className="btn btn-ghost" onClick={() => void openPreview()}>
                  Просмотр
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={uploading}
                  onClick={() => void removeResume()}
                >
                  Удалить файл
                </button>
              </div>
            )}
          </div>
          <div className="field">
            <label>Текст резюме</label>
            <textarea
              rows={5}
              value={form.resume_text || ""}
              onChange={(e) => set("resume_text", e.target.value)}
            />
          </div>
        </section>

        <section className="panel grid gap-4 md:grid-cols-2">
          <h3 className="md:col-span-2 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
            Возраст (16–17)
          </h3>
          <div className="field">
            <label>Дата рождения</label>
            <input
              type="date"
              value={form.birth_date?.slice(0, 10) || ""}
              onChange={(e) => set("birth_date", e.target.value || null)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.parental_consent)}
              onChange={(e) => set("parental_consent", e.target.checked)}
            />
            <span>Согласие родителей на обработку ПДн</span>
          </label>
        </section>

        <section className="panel grid gap-4 md:grid-cols-2">
          <h3 className="md:col-span-2 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
            ФСП и приватность
          </h3>
          <div className="field">
            <label>FSP ID</label>
            <input
              value={form.fsp_id || ""}
              onChange={(e) => set("fsp_id", e.target.value)}
              placeholder="FSP-1001"
            />
          </div>
          <div className="flex flex-col justify-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.privacy_public}
                onChange={(e) => set("privacy_public", e.target.checked)}
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
                onChange={(e) => set("consent_152fz", e.target.checked)}
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

        <button className="btn btn-primary w-full md:w-auto md:justify-self-start" disabled={saving}>
          {saving ? "Сохраняем…" : "Сохранить профиль"}
        </button>
      </form>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр резюме"
        >
          <div className="panel flex max-h-[90vh] w-full max-w-4xl flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{form.resume_file_name}</h2>
              <button type="button" className="btn btn-ghost" onClick={closePreview}>
                Закрыть
              </button>
            </div>
            <div className="min-h-[50vh] flex-1 overflow-auto rounded-xl border border-[var(--line)] bg-white">
              {previewPdfUrl && (
                <iframe title="Просмотр PDF" src={previewPdfUrl} className="h-[70vh] w-full" />
              )}
              {previewHtml && (
                <iframe
                  title="Просмотр Word"
                  srcDoc={previewHtml}
                  className="h-[70vh] w-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
