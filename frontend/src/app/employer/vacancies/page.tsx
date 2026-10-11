"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { labelGrade, labelSpec } from "@/lib/labels";

interface Need {
  id: number;
  title: string;
  specialization: string;
  grade: string;
  stack?: string;
  description?: string;
  salary_from: number;
  salary_to: number;
  salary_gross?: boolean;
  is_suspicious?: boolean;
  is_active?: boolean;
}

type Filter = "all" | "active" | "off" | "hidden";

function stackTags(stack?: string) {
  return (stack || "")
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function formatSalary(from: number, to: number) {
  return `${from.toLocaleString("ru-RU")} – ${to.toLocaleString("ru-RU")} ₽`;
}

export default function MyVacanciesPage() {
  const [items, setItems] = useState<Need[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const rows = await api<Need[]>("/api/employer/needs");
    setItems(rows);
  }

  useEffect(() => {
    void Promise.resolve().then(() =>
      load().catch((e) => {
        setError(formatApiError(e));
        setItems([]);
      }),
    );
  }, []);

  const counts = useMemo(() => {
    const list = items || [];
    return {
      all: list.length,
      active: list.filter((n) => n.is_active !== false && !n.is_suspicious).length,
      off: list.filter((n) => n.is_active === false && !n.is_suspicious).length,
      hidden: list.filter((n) => n.is_suspicious).length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    if (filter === "active") {
      return items.filter((n) => n.is_active !== false && !n.is_suspicious);
    }
    if (filter === "off") {
      return items.filter((n) => n.is_active === false && !n.is_suspicious);
    }
    if (filter === "hidden") {
      return items.filter((n) => n.is_suspicious);
    }
    return items;
  }, [items, filter]);

  async function toggleActive(need: Need) {
    if (need.is_suspicious) return;
    setBusyId(need.id);
    setError("");
    setOk("");
    try {
      const next = need.is_active === false;
      await api<Need>(`/api/employer/needs/${need.id}`, {
        method: "PATCH",
        body: { is_active: next },
      });
      setOk(next ? "Вакансия включена" : "Вакансия отключена");
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function removeNeed(need: Need) {
    if (!window.confirm(`Удалить вакансию «${need.title}»? Это нельзя отменить.`)) {
      return;
    }
    setBusyId(need.id);
    setError("");
    setOk("");
    try {
      await api(`/api/employer/needs/${need.id}`, { method: "DELETE" });
      setOk("Вакансия удалена");
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fsp-vacancy">
      <header className="fsp-vacancy-hero">
        <div>
          <p className="fsp-vacancy-hero-kicker">Управление</p>
          <h1 className="fsp-vacancy-hero-title">Мои вакансии</h1>
          <p className="fsp-vacancy-hero-lead">
            Включайте и отключайте публикации, открывайте подборку или удаляйте ненужные роли.
          </p>
        </div>
        <div className="fsp-vacancy-stats">
          <div className="fsp-vacancy-stat">
            <strong>{items === null ? "…" : counts.all}</strong>
            <span>всего</span>
          </div>
          <div className="fsp-vacancy-stat">
            <strong>{items === null ? "…" : counts.active}</strong>
            <span>активных</span>
          </div>
          <div className="fsp-vacancy-stat">
            <strong>{items === null ? "…" : counts.off}</strong>
            <span>отключено</span>
          </div>
        </div>
      </header>

      <div className="fsp-dossier-toolbar !mb-0">
        <div className="fsp-achievements-filters" role="tablist" aria-label="Фильтр вакансий">
          {(
            [
              ["all", `Все · ${counts.all}`],
              ["active", `Активные · ${counts.active}`],
              ["off", `Отключённые · ${counts.off}`],
              ...(counts.hidden
                ? ([["hidden", `Скрытые · ${counts.hidden}`]] as const)
                : []),
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`fsp-filter-pill${filter === id ? " active" : ""}`}
              onClick={() => setFilter(id as Filter)}
            >
              {label}
            </button>
          ))}
        </div>
        <Link href="/employer/needs" className="btn btn-primary">
          + Новая вакансия
        </Link>
      </div>

      {error && (
        <div className="fsp-soft-block !py-3">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
        </div>
      )}
      {ok && (
        <div className="fsp-soft-block !py-3">
          <p className="text-sm font-semibold text-[var(--ok)]">{ok}</p>
        </div>
      )}

      {items === null && (
        <div className="fsp-soft-block empty-state">
          <p className="muted">Загрузка вакансий…</p>
        </div>
      )}

      {items && !filtered.length && (
        <div className="fsp-soft-block empty-state">
          <p className="font-semibold">
            {items.length ? "В этом фильтре пусто" : "Пока нет вакансий"}
          </p>
          <p className="muted max-w-md text-sm">
            {items.length
              ? "Попробуйте другой фильтр"
              : "Создайте первую вакансию — потом здесь можно будет включать, отключать и удалять."}
          </p>
          {!items.length && (
            <Link href="/employer/needs" className="btn btn-primary mt-3">
              Создать вакансию
            </Link>
          )}
        </div>
      )}

      {items && filtered.length > 0 && (
        <div className="fsp-vacancy-list">
          {filtered.map((n, index) => {
            const tags = stackTags(n.stack);
            const active = n.is_active !== false && !n.is_suspicious;
            const off = n.is_active === false && !n.is_suspicious;
            return (
              <article
                key={n.id}
                className={`fsp-vacancy-card${off ? " is-off" : ""}`}
                style={{ animationDelay: `${Math.min(index, 6) * 0.04}s` }}
              >
                <div className="fsp-vacancy-card-top">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="fsp-vacancy-card-title">{n.title}</h2>
                      {n.is_suspicious ? (
                        <span className="badge !bg-[var(--danger-soft)] !text-[var(--danger)]">
                          скрыта
                        </span>
                      ) : active ? (
                        <span className="badge badge-ok">активна</span>
                      ) : (
                        <span className="badge">отключена</span>
                      )}
                    </div>
                    <p className="fsp-vacancy-card-meta">
                      {labelSpec(n.specialization)} · {labelGrade(n.grade)}
                    </p>
                  </div>
                  <p className="fsp-vacancy-salary">
                    {formatSalary(n.salary_from, n.salary_to)}
                    <span>{n.salary_gross === false ? "net" : "gross"}</span>
                  </p>
                </div>

                <div className="fsp-vacancy-tags">
                  {tags.length ? (
                    tags.map((tag) => (
                      <span key={tag} className="fsp-skill">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="fsp-skill ghost">стек не указан</span>
                  )}
                </div>

                {n.description && (
                  <p className="muted line-clamp-2 text-sm leading-relaxed">{n.description}</p>
                )}

                {n.is_suspicious && (
                  <p className="text-xs font-semibold text-[var(--danger)]">
                    Скрыта из-за жалоб — подборка недоступна, можно только удалить
                  </p>
                )}

                <div className="fsp-vacancy-card-actions">
                  {active && (
                    <Link
                      href={`/employer/match?need_id=${n.id}&specialization=${n.specialization}&grade=${n.grade}&stack=${encodeURIComponent(n.stack || "")}`}
                      className="btn btn-primary"
                    >
                      Открыть подборку
                    </Link>
                  )}
                  {!n.is_suspicious && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busyId === n.id}
                      onClick={() => void toggleActive(n)}
                    >
                      {busyId === n.id
                        ? "…"
                        : active
                          ? "Отключить"
                          : "Включить"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busyId === n.id}
                    onClick={() => void removeNeed(n)}
                  >
                    Удалить
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
