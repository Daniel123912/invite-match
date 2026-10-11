"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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

function isPdf(mime?: string | null) {
  return mime === "application/pdf";
}

function isDocx(mime?: string | null) {
  return mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

export default function EmployerCandidatePage() {
  const params = useParams();
  const id = Number(params.id);
  const [data, setData] = useState<CandidateDossier | null>(null);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

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
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.resume_file_name || "resume";
        a.click();
        URL.revokeObjectURL(url);
        setPreviewOpen(false);
      }
    } catch (err) {
      setPreviewOpen(false);
      setError(formatApiError(err, "Не удалось открыть резюме"));
    }
  }

  if (error && !data) {
    return (
      <div className="panel empty-state">
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
      <div className="panel empty-state">
        <p className="muted">Загрузка карточки кандидата…</p>
      </div>
    );
  }

  const grade = data.confirmed_grade || data.selected_grade;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="muted text-xs">
            <Link href="/employer/match" className="link-quiet">
              Подборка
            </Link>{" "}
            / кандидат
          </p>
          <h2 className="section-title text-xl mt-1">{data.full_name}</h2>
          <p className="muted mt-1 text-sm">
            {data.city || "Город не указан"}
            {data.specialization ? ` · ${labelSpec(data.specialization)}` : ""}
            {grade ? ` · ${labelGrade(grade)}` : ""}
          </p>
        </div>
        <Link href={`/employer/match?invite=${data.id}`} className="btn btn-primary">
          Пригласить
        </Link>
      </div>

      {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}

      <section className="panel grid gap-3 md:grid-cols-3">
        <div>
          <p className="muted text-xs uppercase tracking-wide">Тест</p>
          <p className="text-lg font-bold">{data.test_score ?? "—"}%</p>
        </div>
        <div>
          <p className="muted text-xs uppercase tracking-wide">ФСП</p>
          <p className="text-lg font-bold">
            {data.has_fsp_history ? data.fsp_score : "нет истории"}
          </p>
        </div>
        <div>
          <p className="muted text-xs uppercase tracking-wide">Грейд</p>
          <p className="text-lg font-bold">
            {grade ? labelGrade(grade) : "—"}
            {data.grade_confirmed === false && (
              <span className="ml-2 badge !bg-[var(--warn-soft)] !text-[var(--warn)]">
                не подтверждён
              </span>
            )}
          </p>
        </div>
        {data.reason && <p className="muted text-xs md:col-span-3">{data.reason}</p>}
      </section>

      <section className="panel">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Контакты</h3>
        <ContactMasks
          className="mt-2"
          revealed={Boolean(data.contacts_revealed)}
          phone={data.phone}
          email={data.email}
          telegram={data.telegram}
          phoneDisplay={data.phone_display}
          emailDisplay={data.email_display}
          telegramDisplay={data.telegram_display}
        />
      </section>

      <section className="panel space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Стек</h3>
        <p className="text-sm">{data.stack || "Не указан"}</p>
        <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">О себе</h3>
        <p className="whitespace-pre-wrap text-sm">{data.about || "—"}</p>
      </section>

      <section className="panel space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Резюме</h3>
        {data.has_resume_file ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">{data.resume_file_name}</span>
            <button type="button" className="btn btn-ghost" onClick={() => void openResume()}>
              Открыть файл
            </button>
          </div>
        ) : (
          <p className="muted text-sm">Файл не загружен — смотрите текст ниже</p>
        )}
        <div className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm">
          {data.resume_text?.trim() || "Текст резюме пуст"}
        </div>
      </section>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр резюме"
        >
          <div className="panel flex max-h-[90vh] w-full max-w-4xl flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{data.resume_file_name}</h2>
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
    </div>
  );
}
