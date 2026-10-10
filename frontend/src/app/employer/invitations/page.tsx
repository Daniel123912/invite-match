"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { ChatPanel } from "@/components/ChatPanel";
import { inviteStatusClass, labelInviteStatus } from "@/lib/labels";

interface Invitation {
  id: number;
  candidate_name?: string;
  message: string;
  salary_from: number;
  salary_to: number;
  status: string;
  candidate_phone?: string;
  candidate_telegram?: string;
  candidate_email?: string;
  contacts_revoked?: boolean;
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
              <h3 className="section-title text-base">{inv.candidate_name || "Кандидат"}</h3>
              <p className="mt-1 text-sm">{inv.message}</p>
              <p className="mt-2 font-semibold text-[var(--brand)]">
                {inv.salary_from.toLocaleString("ru-RU")} – {inv.salary_to.toLocaleString("ru-RU")} ₽
              </p>
              {inv.status === "accepted" && !inv.contacts_revoked && (
                <p className="mt-2 text-sm text-[var(--ok)]">
                  Контакты: {inv.candidate_email || "—"} · {inv.candidate_phone || "—"} ·{" "}
                  {inv.candidate_telegram || "—"}
                </p>
              )}
              {inv.status === "accepted" && inv.contacts_revoked && (
                <p className="mt-2 text-sm text-[var(--warn)]">Кандидат отозвал доступ к контактам</p>
              )}
              {inv.status !== "accepted" && (
                <p className="muted mt-2 text-xs">Контакты скрыты до принятия приглашения</p>
              )}
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
