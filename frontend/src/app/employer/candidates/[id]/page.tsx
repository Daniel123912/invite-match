"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ContactMasks } from "@/components/ContactMasks";
import { api, apiFetch, formatApiError } from "@/lib/api";
import { labelGrade, labelSpec } from "@/lib/labels";

interface CandidateDossier {
  id: number;
  full_name: string;
  city?: string;
  about?: string;
  stack?: string;
  specialization?: string;
  selected_grade?: string;
  confirmed_grade?: string;
  grade_confirmed?: boolean;
  test_score?: number;
  fsp_score: number;
  has_fsp_history: boolean;
  reason?: string;
  has_resume_file?: boolean;
  resume_file_name?: string | null;
  resume_content_type?: string | null;
  resume_text?: string | null;
  contacts_revealed?: boolean;
  phone?: string | null;
  email?: string | null;
  telegram?: string | null;
  phone_display?: string;
  email_display?: string;
  telegram_display?: string;
}

type Tab = "info" | "tests";

function isPdf(mime?: string | null) {
  return mime === "application/pdf";
}

function isDocx(mime?: string | null) {
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

export default function EmployerCandidatePage() {
  const params = useParams();
  const id = Number(params.id);
  const [data, setData] = useState<CandidateDossier | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("info");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<CandidateDossier>(`/api/employer/candidates/${id}`)
      .then(setData)
      .catch((e) => setError(formatApiError(e)));
  }, [id]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  function closePreview() {
    setPreviewOpen(false);
    setPreviewHtml(null);
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewPdfUrl(null);
  }

  function triggerBlobDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function openResume() {
    if (!data?.has_resume_file) return;
    setError("");
    closePreview();
    setPreviewOpen(true);
    try {
      if (isPdf(data.resume_content_type)) {
        const res = await apiFetch(`/api/employer/candidates/${id}/resume/file`);
        const blob = await res.blob();
        setPreviewPdfUrl(URL.createObjectURL(blob));
      } else if (isDocx(data.resume_content_type)) {
        const res = await apiFetch(`/api/employer/candidates/${id}/resume/preview`);
        setPreviewHtml(await res.text());
      } else {
        const res = await apiFetch(`/api/employer/candidates/${id}/resume/file`);
        const blob = await res.blob();
        triggerBlobDownload(blob, data.resume_file_name || "resume");
        setPreviewOpen(false);
      }
    } catch (err) {
      setPreviewOpen(false);
      setError(formatApiError(err, "Не удалось открыть резюме"));
    }
  }

  async function downloadResumeFile() {
    if (!data?.has_resume_file) return;
    setError("");
    setDownloading(true);
    try {
      const res = await apiFetch(`/api/employer/candidates/${id}/resume/file`);
      const blob = await res.blob();
      triggerBlobDownload(blob, data.resume_file_name || `resume_${id}`);
    } catch (err) {
      setError(formatApiError(err, "Не удалось скачать резюме"));
    } finally {
      setDownloading(false);
    }
  }

  async function downloadProfilePdf() {
    setError("");
    setDownloading(true);
    try {
      const res = await apiFetch(`/api/employer/candidates/${id}/profile/pdf`);
      const blob = await res.blob();
      const safe = (data?.full_name || "candidate").replace(/[^\w\-]+/g, "_").slice(0, 40);
      triggerBlobDownload(blob, `resume_${safe}_${id}.pdf`);
    } catch (err) {
      setError(formatApiError(err, "Не удалось скачать PDF-профиль"));
    } finally {
      setDownloading(false);
    }
  }

  const skills = useMemo(() => stackTags(data?.stack), [data?.stack]);

  if (error && !data) {
    return (
      <div className="fsp-soft-block empty-state">
        <p className="font-semibold text-[var(--danger)]">Не удалось открыть кандидата</p>
        <p className="muted text-sm">{error}</p>
        <Link href="/employer/match" className="btn btn-ghost mt-2">
          К подборке
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fsp-soft-block empty-state">
        <p className="muted">Загрузка карточки кандидата…</p>
      </div>
    );
  }

  const grade = data.confirmed_grade || data.selected_grade;
  const specLabel = data.specialization
    ? labelSpec(data.specialization)
    : "Специализация не указана";

  return (
    <div>
      <Link href="/employer/match" className="fsp-back">
        ← Назад
      </Link>

      <header className="fsp-profile-hero">
        <div className="fsp-avatar" aria-hidden>
          <span>{initials(data.full_name)}</span>
        </div>
        <div className="fsp-profile-meta">
          <h1 className="fsp-profile-name">
            <span>{data.full_name}</span>
            <span className="status-dot brand" aria-hidden />
          </h1>
          <p className="fsp-profile-spec">{specLabel}</p>
          <p className="fsp-skills-label">навыки</p>
          <div className="fsp-skill-row">
            {skills.length ? (
              skills.map((skill) => (
                <span key={skill} className="fsp-skill">
                  {skill}
                </span>
              ))
            ) : (
              <span className="fsp-skill ghost">стек не указан</span>
            )}
          </div>
          {(data.city || grade) && (
            <p className="muted mt-3 text-sm">
              {[data.city, grade ? labelGrade(grade) : null].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </header>

      <div className="fsp-dossier-toolbar">
        <div className="fsp-dossier-tabs" role="tablist" aria-label="Разделы карточки">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "info"}
            className={`fsp-dossier-tab${tab === "info" ? " active" : ""}`}
            onClick={() => setTab("info")}
          >
            осн инф
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "tests"}
            className={`fsp-dossier-tab${tab === "tests" ? " active" : ""}`}
            onClick={() => setTab("tests")}
          >
            рез тестов
          </button>
        </div>
        <Link href={`/employer/match?invite=${data.id}`} className="fsp-invite-btn">
          пригласить
        </Link>
      </div>

      {error && <p className="mb-3 text-sm font-semibold text-[var(--danger)]">{error}</p>}

      {tab === "info" ? (
        <div className="fsp-dossier-grid">
          <section className="fsp-soft-block">
            <h2 className="fsp-soft-block-title">полная информация</h2>
            <dl className="fsp-stat-grid">
              <div className="fsp-stat">
                <dt>Город</dt>
                <dd>{data.city || "—"}</dd>
              </div>
              <div className="fsp-stat">
                <dt>Грейд</dt>
                <dd>
                  {grade ? labelGrade(grade) : "—"}
                  {data.grade_confirmed === false && grade ? (
                    <span className="ml-2 badge !bg-[var(--warn-soft)] !text-[var(--warn)]">
                      не подтверждён
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="fsp-stat">
                <dt>Стек</dt>
                <dd className="!text-sm !font-semibold">{data.stack || "Не указан"}</dd>
              </div>
              <div className="fsp-stat">
                <dt>Резюме</dt>
                <dd className="!text-sm !font-semibold">
                  {data.has_resume_file ? data.resume_file_name || "файл загружен" : "нет файла"}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <h3 className="mb-2 text-sm font-bold text-[var(--muted)]">Контакты</h3>
              <ContactMasks
                revealed={Boolean(data.contacts_revealed)}
                phone={data.phone}
                email={data.email}
                telegram={data.telegram}
                phoneDisplay={data.phone_display}
                emailDisplay={data.email_display}
                telegramDisplay={data.telegram_display}
              />
            </div>

            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-bold text-[var(--muted)]">Резюме</h3>
              {data.has_resume_file ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge">{data.resume_file_name}</span>
                  <button type="button" className="btn btn-ghost" onClick={() => void openResume()}>
                    Открыть
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={downloading}
                    onClick={() => void downloadResumeFile()}
                  >
                    {downloading ? "Скачиваем…" : "Скачать файл"}
                  </button>
                </div>
              ) : (
                <p className="muted text-sm">Файл не загружен — смотрите текст ниже или скачайте PDF-профиль</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={downloading}
                  onClick={() => void downloadProfilePdf()}
                >
                  Скачать PDF-профиль
                </button>
              </div>
              <div className="max-h-[280px] overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--line)] bg-white/70 p-3 text-sm">
                {data.resume_text?.trim() || "Текст резюме пуст"}
              </div>
            </div>
          </section>

          <section className="fsp-soft-block">
            <h2 className="fsp-soft-block-title">о себе</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {data.about?.trim() || "Кандидат ещё не заполнил раздел «О себе»"}
            </p>
          </section>

          <section className="fsp-soft-block fsp-dossier-span">
            <h2 className="fsp-soft-block-title">достижения</h2>
            <dl className="fsp-stat-grid">
              <div className="fsp-stat">
                <dt>Тест</dt>
                <dd>{data.test_score != null ? `${data.test_score}%` : "—"}</dd>
              </div>
              <div className="fsp-stat">
                <dt>ФСП</dt>
                <dd>{data.has_fsp_history ? data.fsp_score : "нет истории"}</dd>
              </div>
              <div className="fsp-stat">
                <dt>Грейд</dt>
                <dd>{grade ? labelGrade(grade) : "—"}</dd>
              </div>
              <div className="fsp-stat">
                <dt>Специализация</dt>
                <dd className="!text-sm !font-semibold">{specLabel}</dd>
              </div>
            </dl>
            {data.reason && <p className="muted mt-3 text-xs">{data.reason}</p>}
          </section>
        </div>
      ) : (
        <div className="fsp-dossier-grid">
          <section className="fsp-soft-block fsp-dossier-span">
            <h2 className="fsp-soft-block-title">результаты тестов</h2>
            <dl className="fsp-stat-grid">
              <div className="fsp-stat">
                <dt>Балл теста</dt>
                <dd>{data.test_score != null ? `${data.test_score}%` : "—"}</dd>
              </div>
              <div className="fsp-stat">
                <dt>Подтверждённый грейд</dt>
                <dd>
                  {data.confirmed_grade ? labelGrade(data.confirmed_grade) : "—"}
                  {data.grade_confirmed === false && (
                    <span className="ml-2 badge !bg-[var(--warn-soft)] !text-[var(--warn)]">
                      не подтверждён
                    </span>
                  )}
                </dd>
              </div>
              <div className="fsp-stat">
                <dt>Выбранный грейд</dt>
                <dd>{data.selected_grade ? labelGrade(data.selected_grade) : "—"}</dd>
              </div>
              <div className="fsp-stat">
                <dt>ФСП-рейтинг</dt>
                <dd>{data.has_fsp_history ? data.fsp_score : "нет истории"}</dd>
              </div>
            </dl>
            {data.reason && (
              <p className="muted mt-4 text-sm leading-relaxed">{data.reason}</p>
            )}
          </section>
        </div>
      )}

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр резюме"
        >
          <div className="panel flex max-h-[90vh] w-full max-w-4xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{data.resume_file_name}</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={downloading}
                  onClick={() => void downloadResumeFile()}
                >
                  Скачать
                </button>
                <button type="button" className="btn btn-ghost" onClick={closePreview}>
                  Закрыть
                </button>
              </div>
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
    </div>
  );
}
