"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ContactMasks } from "@/components/ContactMasks";
import { api, formatApiError } from "@/lib/api";
import { inviteStatusClass, labelInviteStatus } from "@/lib/labels";

interface Invitation {
  id: number;
  candidate_id: number;
  candidate_name?: string;
  message: string;
  salary_from: number;
  salary_to: number;
  salary_gross?: boolean;
  status: string;
  created_at?: string;
  candidate_phone?: string;
  candidate_telegram?: string;
  candidate_email?: string;
  contacts_revealed?: boolean;
  contacts_revoked?: boolean;
  phone_display?: string;
  email_display?: string;
  telegram_display?: string;
}

type Filter = "all" | "sent" | "viewed" | "accepted" | "declined";

function canChat(status: string) {
  return status === "sent" || status === "viewed" || status === "accepted";
}

function formatSalary(from: number, to: number, gross?: boolean) {
  return `${from.toLocaleString("ru-RU")} – ${to.toLocaleString("ru-RU")} ₽ · ${
    gross === false ? "net" : "gross"
  }`;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function InvitedCandidatesPage() {
  const [items, setItems] = useState<Invitation[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Invitation[]>("/api/employer/invitations")
      .then((rows) => {
        setItems(rows);
        setError("");
      })
      .catch((e) => {
        setError(formatApiError(e));
        setItems([]);
      });
  }, []);

  const counts = useMemo(() => {
    const list = items || [];
    return {
      all: list.length,
      sent: list.filter((i) => i.status === "sent").length,
      viewed: list.filter((i) => i.status === "viewed").length,
      accepted: list.filter((i) => i.status === "accepted").length,
      declined: list.filter((i) => i.status === "declined").length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const list = filter === "all" ? items : items.filter((i) => i.status === filter);
    return list
      .slice()
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta || b.id - a.id;
      });
  }, [items, filter]);

  return (
    <div className="fsp-vacancy">
      <header className="fsp-vacancy-hero">
        <div>
          <p className="fsp-vacancy-hero-kicker">Отклики</p>
          <h1 className="fsp-vacancy-hero-title">Приглашённые кандидаты</h1>
          <p className="fsp-vacancy-hero-lead">
            Все исходящие приглашения: статус, вилка и контакты. Чат — в разделе «Сообщения».
          </p>
        </div>
        <div className="fsp-vacancy-stats">
          <div className="fsp-vacancy-stat">
            <strong>{items === null ? "…" : counts.all}</strong>
            <span>всего</span>
          </div>
          <div className="fsp-vacancy-stat">
            <strong>{items === null ? "…" : counts.accepted}</strong>
            <span>принято</span>
          </div>
          <div className="fsp-vacancy-stat">
            <strong>{items === null ? "…" : counts.sent + counts.viewed}</strong>
            <span>в ожидании</span>
          </div>
        </div>
      </header>

      <div className="fsp-dossier-toolbar !mb-0">
        <div className="fsp-achievements-filters" role="tablist" aria-label="Фильтр приглашений">
          {(
            [
              ["all", `Все · ${counts.all}`],
              ["sent", `Отправлено · ${counts.sent}`],
              ["viewed", `Просмотрено · ${counts.viewed}`],
              ["accepted", `Принято · ${counts.accepted}`],
              ["declined", `Отклонено · ${counts.declined}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`fsp-filter-pill${filter === id ? " active" : ""}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <Link href="/employer/match" className="btn btn-primary">
          Найти кандидатов
        </Link>
      </div>

      {error && (
        <div className="fsp-soft-block !py-3">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
        </div>
      )}

      {items === null && (
        <div className="fsp-soft-block empty-state">
          <p className="muted">Загрузка приглашений…</p>
        </div>
      )}

      {items && !filtered.length && (
        <div className="fsp-soft-block empty-state">
          <p className="font-semibold">
            {items.length ? "В этом фильтре пусто" : "Приглашённых кандидатов пока нет"}
          </p>
          <p className="muted max-w-md text-sm">
            {items.length
              ? "Попробуйте другой статус"
              : "Отправьте оффер из раздела «Поиск кандидатов» — список появится здесь."}
          </p>
          {!items.length && (
            <Link href="/employer/match" className="btn btn-primary mt-3">
              Открыть подборку
            </Link>
          )}
        </div>
      )}

      {items && filtered.length > 0 && (
        <div className="fsp-vacancy-list">
          {filtered.map((inv, index) => (
            <article
              key={inv.id}
              className={`fsp-vacancy-card${inv.status === "declined" ? " is-off" : ""}`}
              style={{ animationDelay: `${Math.min(index, 6) * 0.04}s` }}
            >
              <div className="fsp-vacancy-card-top">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="fsp-vacancy-card-title">
                      {inv.candidate_name || `Кандидат #${inv.candidate_id}`}
                    </h2>
                    <span className={`badge ${inviteStatusClass(inv.status)}`}>
                      {labelInviteStatus(inv.status)}
                    </span>
                  </div>
                  <p className="fsp-vacancy-card-meta">
                    Приглашение #{inv.id}
                    {inv.created_at ? ` · ${formatDate(inv.created_at)}` : ""}
                  </p>
                </div>
                <p className="fsp-vacancy-salary">
                  {formatSalary(inv.salary_from, inv.salary_to, inv.salary_gross)}
                </p>
              </div>

              {inv.message && (
                <p className="muted line-clamp-2 text-sm leading-relaxed">{inv.message}</p>
              )}

              <ContactMasks
                revealed={Boolean(inv.contacts_revealed)}
                revoked={Boolean(inv.contacts_revoked)}
                phone={inv.candidate_phone}
                email={inv.candidate_email}
                telegram={inv.candidate_telegram}
                phoneDisplay={inv.phone_display}
                emailDisplay={inv.email_display}
                telegramDisplay={inv.telegram_display}
              />

              <div className="fsp-vacancy-card-actions">
                <Link
                  href={`/employer/candidates/${inv.candidate_id}`}
                  className="btn btn-ghost !px-3 !py-2 text-sm"
                >
                  Профиль
                </Link>
                {canChat(inv.status) && (
                  <Link
                    href={`/employer/invitations?id=${inv.id}`}
                    className="btn btn-primary !px-3 !py-2 text-sm"
                  >
                    Сообщения
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
