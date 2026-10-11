"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { ChatPanel } from "@/components/ChatPanel";
import { ContactMasks } from "@/components/ContactMasks";
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
  candidate_phone?: string;
  candidate_telegram?: string;
  candidate_email?: string;
  contacts_revealed?: boolean;
  contacts_revoked?: boolean;
  phone_display?: string;
  email_display?: string;
  telegram_display?: string;
}

type Filter = "all" | "pending" | "accepted" | "declined";

export default function EmployerInvitationsPage() {
  const [items, setItems] = useState<Invitation[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    api<Invitation[]>("/api/employer/invitations")
      .then(setItems)
      .catch((e) => {
        setError(formatApiError(e));
        setItems([]);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    if (filter === "pending") return items.filter((i) => i.status === "sent" || i.status === "viewed");
    if (filter === "accepted") return items.filter((i) => i.status === "accepted");
    if (filter === "declined") return items.filter((i) => i.status === "declined");
    return items;
  }, [items, filter]);

  if (items === null && !error) {
    return (
      <div className="panel empty-state">
        <p className="muted">Загрузка приглашений…</p>
      </div>
    );
  }

  if (error && !items?.length) {
    return (
      <div className="panel empty-state">
        <p className="font-semibold text-[var(--danger)]">Ошибка загрузки</p>
        <p className="muted text-sm">{error}</p>
        <button className="btn btn-ghost mt-2" onClick={() => window.location.reload()}>
          Повторить
        </button>
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div className="panel empty-state">
        <p className="section-title">Приглашений пока нет</p>
        <p className="muted text-sm">Отправьте оффер из раздела «Подборка»</p>
        <Link href="/employer/match" className="btn btn-primary mt-3">
          Открыть подборку
        </Link>
      </div>
    );
  }

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "Все" },
    { id: "pending", label: "Ожидают" },
    { id: "accepted", label: "Приняты" },
    { id: "declined", label: "Отклонены" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="section-title text-xl">Исходящие приглашения</h2>
        <p className="muted mt-1 text-sm">Контакты видны только после принятия оффера</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${filter === t.id ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!filtered.length && (
        <div className="panel empty-state">
          <p className="muted text-sm">В этом фильтре пусто</p>
        </div>
      )}

      {filtered.map((inv) => (
        <div key={inv.id} className="panel">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="section-title text-base">{inv.candidate_name || "Кандидат"}</h3>
                <Link
                  href={`/employer/candidates/${inv.candidate_id}`}
                  className="text-xs font-semibold text-[var(--brand)] underline"
                >
                  Изучить профиль
                </Link>
              </div>
              <p className="mt-1 text-sm">{inv.message}</p>
              <p className="mt-2 font-semibold text-[var(--brand)]">
                {inv.salary_from.toLocaleString("ru-RU")} – {inv.salary_to.toLocaleString("ru-RU")} ₽{" "}
                <span className="text-sm font-normal text-[var(--muted)]">
                  {inv.salary_gross === false ? "(net)" : "(gross)"}
                </span>
              </p>
              <ContactMasks
                className="mt-2"
                revealed={Boolean(inv.contacts_revealed)}
                revoked={Boolean(inv.contacts_revoked)}
                phone={inv.candidate_phone}
                email={inv.candidate_email}
                telegram={inv.candidate_telegram}
                phoneDisplay={inv.phone_display}
                emailDisplay={inv.email_display}
                telegramDisplay={inv.telegram_display}
              />
            </div>
            <span className={`badge ${inviteStatusClass(inv.status)}`}>
              {labelInviteStatus(inv.status)}
            </span>
          </div>
          {(inv.status === "sent" || inv.status === "viewed" || inv.status === "accepted") && (
            <ChatPanel invitationId={inv.id} />
          )}
        </div>
      ))}
    </div>
  );
}
