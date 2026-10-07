"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Invitation {
  id: number;
  company_name?: string;
  message: string;
  salary_from: number;
  salary_to: number;
  status: string;
  reason?: string;
}

const STATUS_LABELS: Record<string, string> = {
  sent: "Новое",
  viewed: "Просмотрено",
  accepted: "Принято",
  declined: "Отклонено",
};

function statusClass(status: string) {
  if (status === "accepted") return "!bg-[#e8f6ee] !text-[var(--ok)]";
  if (status === "declined") return "!bg-[#fdecec] !text-[var(--danger)]";
  if (status === "viewed") return "!bg-[#fff4e8] !text-[var(--warn)]";
  return "";
}

export default function InvitationsPage() {
  const [items, setItems] = useState<Invitation[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    try {
      setItems(await api<Invitation[]>("/api/invitations/incoming"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function respond(id: number, status: "accepted" | "declined") {
    setBusyId(id);
    setError("");
    try {
      await api(`/api/invitations/${id}`, {
        method: "PATCH",
        body: { status },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  async function revokeContacts(id: number) {
    setBusyId(id);
    setError("");
    try {
      await api(`/api/candidate/invitations/${id}/contacts`, {
        method: "PATCH",
        body: { revoke: true },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  if (items === null && !error) {
    return (
      <div className="panel empty-state">
        <p className="muted">Загрузка приглашений…</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-sora)" }}>
          Приглашения
        </h2>
        <p className="muted mt-1 text-sm">
          Контакты откроются работодателю только после принятия
        </p>
      </div>

      {error && (
        <div className="panel !py-3">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
        </div>
      )}

      {!items?.length ? (
        <div className="panel empty-state">
          <p className="font-semibold">Пока нет входящих приглашений</p>
          <p className="muted max-w-md text-sm">
            Когда работодатель найдёт вашу категорию, оффер появится здесь.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((inv) => (
            <article key={inv.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold">{inv.company_name || "Компания"}</h3>
                  <p className="mt-2 text-sm leading-relaxed">{inv.message}</p>
                  <p className="mt-3 text-base font-bold text-[var(--brand)]">
                    {inv.salary_from.toLocaleString("ru-RU")} – {inv.salary_to.toLocaleString("ru-RU")} ₽
                  </p>
                  {inv.reason && (
                    <p className="muted mt-2 text-xs leading-relaxed">Почему вы: {inv.reason}</p>
                  )}
                </div>
                <span className={`badge ${statusClass(inv.status)}`}>
                  {STATUS_LABELS[inv.status] || inv.status}
                </span>
              </div>

              {(inv.status === "sent" || inv.status === "viewed") && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn btn-ok"
                    disabled={busyId === inv.id}
                    onClick={() => respond(inv.id, "accepted")}
                  >
                    Принять
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={busyId === inv.id}
                    onClick={() => respond(inv.id, "declined")}
                  >
                    Отклонить
                  </button>
                </div>
              )}

              {inv.status === "accepted" && (
                <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
                  <button
                    className="btn btn-danger"
                    disabled={busyId === inv.id}
                    onClick={() => revokeContacts(inv.id)}
                  >
                    Отозвать доступ к контактам
                  </button>
                  <p className="muted mt-2 text-xs">
                    По 152-ФЗ можно закрыть телефон и email для работодателя
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
