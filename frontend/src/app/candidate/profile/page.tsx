"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, apiFetch, formatApiError } from "@/lib/api";
import { labelGrade, labelSpec } from "@/lib/labels";
import { formatPhoneInput, phoneToE164 } from "@/lib/masks";

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
  specialization?: string;
  selected_grade?: string;
  confirmed_grade?: string;
  test_score?: number;
}

function isPdfResume(mime?: string | null) {
  return mime === "application/pdf";
}

function isDocxResume(mime?: string | null) {
  return mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function initials(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function stackTags(stack?: string) {
  return (stack || "")
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
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
      .then((p) =>
        setForm({
          ...p,
          phone: p.phone ? formatPhoneInput(p.phone) : p.phone,
        }),
      )
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
      const payload = {
        ...next,
        phone: next.phone ? phoneToE164(next.phone) : next.phone,
      };
      const updated = await api<Profile>("/api/candidate/profile", {
        method: "PATCH",
        body: payload,
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

  async function downloadProfilePdf() {
    setError("");
    try {
      const res = await apiFetch("/api/candidate/profile/pdf");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "profile.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setMsg("PDF-профиль скачан");
    } catch (err) {
      setError(formatApiError(err, "Не удалось сформировать PDF"));
    }
  }

  const skills = useMemo(() => stackTags(form?.stack), [form?.stack]);

  if (loadError) {
    return (
      <div className="fsp-soft-block empty-state">
        <p className="font-semibold text-[var(--danger)]">Не удалось загрузить профиль</p>
        <p className="muted text-sm">{loadError}</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="fsp-soft-block empty-state">
        <p className="muted">Загрузка профиля…</p>
      </div>
    );
  }

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, [key]: value };
      if (key === "consent_152fz" || key === "privacy_public") {
        void (async () => {
          setMsg("");
          setError("");
          setSaving(true);
          try {
            const updated = await api<Profile>("/api/candidate/profile", {
              method: "PATCH",
              body: { [key]: value },
            });
            setForm(updated);
            setMsg("Сохранено");
          } catch (err) {
            setError(formatApiError(err));
            setForm(f);
          } finally {
            setSaving(false);
          }
        })();
      }
      return next;
    });
  }

  const hasResumeFile = Boolean(form.resume_file_name);
  const specLabel = form.specialization
    ? labelSpec(form.specialization)
    : "Специализация ещё не выбрана";
  const gradeLabel = form.confirmed_grade
    ? labelGrade(form.confirmed_grade)
    : form.selected_grade
      ? `${labelGrade(form.selected_grade)} (выбран)`
      : "—";

  return (
    <>
      <header className="fsp-profile-hero">
        <div className="fsp-avatar" aria-hidden>
          {initials(form.full_name)}
        </div>
        <div className="fsp-profile-meta">
          <h1 className="fsp-profile-name">
            <span>{form.full_name?.trim() || "ФИО не указано"}</span>
            <span className="status-dot brand" aria-hidden />
          </h1>
          <p className="fsp-profile-spec">{specLabel}</p>
          <p className="fsp-skills-label">навыки</p>
          <div className="fsp-skill-row">
            {skills.length ? (
              skills.map((skill) => (
                <span key={skill} className="fsp-skill ghost">
                  {skill}
                </span>
              ))
            ) : (
              <span className="fsp-skill ghost">добавьте стек ниже</span>
            )}
          </div>
          <p className="muted mt-3 text-sm">
            Контакты скрыты от работодателей до принятия приглашения
          </p>
        </div>
      </header>

      <form onSubmit={onSubmit} className="grid gap-4">
        <section className="fsp-soft-block">
          <h2 className="fsp-soft-block-title">основная информация</h2>
          <div className="grid gap-4 md:grid-cols-2">
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
              <input
                value={form.phone || ""}
                onChange={(e) => set("phone", formatPhoneInput(e.target.value))}
                placeholder="+7 (___) ___-__-__"
                inputMode="tel"
              />
              <p className="muted mt-1 text-xs">Для работодателей — под маской до принятия оффера</p>
            </div>
            <div className="field">
              <label>Telegram</label>
              <input
                value={form.telegram || ""}
                onChange={(e) => set("telegram", e.target.value)}
                placeholder="@username"
              />
            </div>
            <div className="field md:col-span-2">
              <label>Стек (через запятую)</label>
              <input
                value={form.stack || ""}
                onChange={(e) => set("stack", e.target.value)}
                placeholder="Python, FastAPI, PostgreSQL"
              />
            </div>
            <div className="field">
              <label>Дата рождения</label>
              <input
                type="date"
                value={form.birth_date?.slice(0, 10) || ""}
                onChange={(e) => set("birth_date", e.target.value || null)}
              />
            </div>
            <label className="flex items-start gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(form.parental_consent)}
                onChange={(e) => set("parental_consent", e.target.checked)}
              />
              <span>Согласие родителей на обработку ПДн (16–17)</span>
            </label>
          </div>
        </section>

        <section className="fsp-soft-block">
          <h2 className="fsp-soft-block-title">о себе</h2>
          <div className="field">
            <label htmlFor="about">О себе</label>
            <textarea
              id="about"
              rows={4}
              value={form.about || ""}
              onChange={(e) => set("about", e.target.value)}
              placeholder="Кратко расскажите о себе, опыте и целях"
            />
          </div>
        </section>

        <section className="fsp-soft-block">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <h2 className="fsp-soft-block-title">достижения</h2>
              <dl className="fsp-stat-grid">
                <div className="fsp-stat">
                  <dt>FSP Score</dt>
                  <dd>{form.fsp_score ?? 0}</dd>
                </div>
                <div className="fsp-stat">
                  <dt>История FSP</dt>
                  <dd>{form.has_fsp_history ? "Есть" : "Нет"}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h2 className="fsp-soft-block-title">результаты тестов</h2>
              <dl className="fsp-stat-grid">
                <div className="fsp-stat">
                  <dt>Балл теста</dt>
                  <dd>{form.test_score != null ? `${form.test_score}%` : "—"}</dd>
                </div>
                <div className="fsp-stat">
                  <dt>Категория</dt>
                  <dd>
                    {form.confirmed_grade
                      ? `${labelSpec(form.specialization)} × ${gradeLabel}`
                      : gradeLabel}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/candidate/test" className="btn btn-ghost">
                  К тесту
                </Link>
                <Link href="/candidate/tasks" className="btn btn-ghost">
                  К заданиям
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="fsp-soft-block grid gap-4">
          <h2 className="fsp-soft-block-title">резюме</h2>
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
          <button
            type="button"
            className="btn btn-ghost w-fit"
            disabled={!form.consent_152fz}
            onClick={() => void downloadProfilePdf()}
          >
            Скачать PDF-профиль
          </button>
        </section>

        <section className="fsp-soft-block !py-4">
          <p className="text-sm">
            FSP ID, видимость в подборке и согласие 152-ФЗ — в{" "}
            <Link href="/candidate/settings" className="font-semibold text-[var(--brand)] underline">
              Настройках
            </Link>
            .
          </p>
          {!form.consent_152fz && (
            <p className="mt-2 text-xs text-[var(--danger)]">
              Сейчас согласие снято — опрос и тест недоступны.
            </p>
          )}
        </section>

        {(msg || error) && (
          <div className="fsp-soft-block !py-3">
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
