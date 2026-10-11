"use client";

import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { labelGrade, labelIndustry, labelSpec } from "@/lib/labels";

interface Need {
  id: number;
  title: string;
  specialization: string;
  grade: string;
  stack?: string | null;
  description?: string | null;
  salary_from: number;
  salary_to: number;
  salary_gross: boolean;
  company_name: string;
  company_verified: boolean;
  company_description?: string | null;
  company_city?: string | null;
  company_website?: string | null;
  company_industry?: string | null;
  is_suspicious: boolean;
  created_at?: string | null;
}

function stackTags(stack?: string | null) {
  return (stack || "")
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function excerpt(text?: string | null, max = 180) {
  const t = (text || "").trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function formatSalary(from: number, to: number, gross: boolean) {
  return `${from.toLocaleString("ru-RU")} – ${to.toLocaleString("ru-RU")} ₽ ${
    gross ? "до вычета НДФЛ" : "на руки"
  }`;
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export default function VacanciesPage() {
  const [items, setItems] = useState<Need[] | null>(null);
  const [selected, setSelected] = useState<Need | null>(null);
  const [reason, setReason] = useState("Подозрение на фиктивную вакансию без деталей");
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<Need[]>("/api/candidate/needs/public")
      .then(setItems)
      .catch((e) => {
        setError(formatApiError(e));
        setItems([]);
      });
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) => {
      const hay = [
        n.title,
        n.company_name,
        n.stack,
        n.description,
        labelSpec(n.specialization),
        labelGrade(n.grade),
        n.company_city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  async function report(id: number) {
    setMsg("");
    setMsgOk(false);
    setBusyId(id);
    try {
      await api(`/api/candidate/needs/${id}/report`, { method: "POST", body: { reason } });
      setMsg("Жалоба отправлена");
      setMsgOk(true);
      setSelected(null);
      setItems(await api<Need[]>("/api/candidate/needs/public"));
    } catch (e) {
      setMsg(formatApiError(e));
      setMsgOk(false);
    } finally {
      setBusyId(null);
    }
  }

  if (items === null) {
    return (
      <div className="panel empty-state">
        <p className="muted">Загрузка вакансий…</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 page-enter">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title font-display text-xl">Вакансии</h2>
          <p className="muted text-sm">
            Открытые потребности работодателей — откройте карточку, чтобы прочитать полностью.
          </p>
        </div>
        <p className="muted text-sm tabular-nums">{filtered.length} из {items.length}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_minmax(220px,280px)]">
        <div className="field">
          <label>Поиск</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название, компания, стек, город…"
          />
        </div>
        <div className="field">
          <label>Причина жалобы</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
      {msg && (
        <p className={`text-sm font-semibold ${msgOk ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>
          {msg}
        </p>
      )}

      {!filtered.length ? (
        <div className="panel empty-state">
          <p className="font-semibold">
            {items.length ? "Ничего не найдено" : "Пока нет опубликованных вакансий"}
          </p>
          <p className="muted text-sm">
            {items.length
              ? "Попробуйте другой запрос"
              : "Работодатели появятся здесь после создания потребностей"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((n) => {
            const tags = stackTags(n.stack);
            return (
              <article
                key={n.id}
                className="panel vacancy-card cursor-pointer"
                onClick={() => setSelected(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(n);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold leading-snug">{n.title}</h3>
                      {n.company_verified && <span className="badge badge-ok">Проверена</span>}
                    </div>
                    <p className="text-sm font-semibold text-[var(--brand-dark)]">{n.company_name}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="badge">{labelSpec(n.specialization)}</span>
                      <span className="badge">{labelGrade(n.grade)}</span>
                      {n.company_city && <span className="badge badge-accent">{n.company_city}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-[var(--brand)]">
                      {n.salary_from.toLocaleString("ru-RU")} – {n.salary_to.toLocaleString("ru-RU")} ₽
                    </p>
                    <p className="muted text-xs">{n.salary_gross ? "gross" : "net"}</p>
                  </div>
                </div>

                {n.description && (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]/90">
                    {excerpt(n.description)}
                  </p>
                )}

                {!!tags.length && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span key={t} className="vacancy-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)]/70 pt-3">
                  <span className="muted text-xs">Нажмите, чтобы открыть полное описание</span>
                  <span className="btn btn-ghost !px-3 !py-1.5 text-sm">Подробнее</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
          onClick={() => setSelected(null)}
        >
          <div
            className="vacancy-detail panel-solid flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vacancy-detail-hero shrink-0 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.company_verified && (
                      <span className="badge badge-ok">Компания проверена</span>
                    )}
                    {formatDate(selected.created_at) && (
                      <span className="muted text-xs">опубликовано {formatDate(selected.created_at)}</span>
                    )}
                  </div>
                  <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">
                    {selected.title}
                  </h2>
                  <p className="text-base font-semibold text-[var(--brand-dark)]">
                    {selected.company_name}
                    {selected.company_city ? ` · ${selected.company_city}` : ""}
                  </p>
                </div>
                <button type="button" className="btn btn-ghost shrink-0" onClick={() => setSelected(null)}>
                  Закрыть
                </button>
              </div>

              <p className="mt-4 text-xl font-bold text-[var(--brand)]">
                {formatSalary(selected.salary_from, selected.salary_to, selected.salary_gross)}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="badge">{labelSpec(selected.specialization)}</span>
                <span className="badge">{labelGrade(selected.grade)}</span>
                {selected.company_industry && (
                  <span className="badge badge-accent">{labelIndustry(selected.company_industry)}</span>
                )}
              </div>
            </div>

            <div className="vacancy-detail-body min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
              <section>
                <h3 className="vacancy-section-label">О вакансии</h3>
                <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed">
                  {(selected.description || "").trim() || "Описание не указано"}
                </p>
              </section>

              {!!stackTags(selected.stack).length && (
                <section>
                  <h3 className="vacancy-section-label">Стек</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {stackTags(selected.stack).map((t) => (
                      <span key={t} className="vacancy-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {(selected.company_description || selected.company_website) && (
                <section>
                  <h3 className="vacancy-section-label">О компании</h3>
                  {selected.company_description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]/90">
                      {selected.company_description}
                    </p>
                  )}
                  {selected.company_website && (
                    <a
                      href={
                        selected.company_website.startsWith("http")
                          ? selected.company_website
                          : `https://${selected.company_website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm font-semibold text-[var(--brand)] underline"
                    >
                      {selected.company_website}
                    </a>
                  )}
                </section>
              )}

              <section className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
                <h3 className="vacancy-section-label">Пожаловаться</h3>
                <p className="muted mt-1 text-xs">
                  Если вакансия выглядит фиктивной или вводит в заблуждение — отправьте жалобу.
                </p>
                <button
                  type="button"
                  className="btn btn-danger mt-3"
                  disabled={busyId === selected.id}
                  onClick={() => void report(selected.id)}
                >
                  {busyId === selected.id ? "Отправка…" : "Пожаловаться на вакансию"}
                </button>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
