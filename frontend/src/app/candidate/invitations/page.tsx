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

export default function InvitationsPage() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems(await api<Invitation[]>("/api/invitations/incoming"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function respond(id: number, status: "accepted" | "declined") {
    try {
      await api(`/api/invitations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function revokeContacts(id: number) {
    try {
      await api(`/api/candidate/invitations/${id}/contacts`, {
        method: "PATCH",
        body: JSON.stringify({ revoke: true }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  if (error) return <p className="text-[var(--danger)]">{error}</p>;

  if (!items.length) {
    return <div className="panel muted">Пока нет входящих приглашений</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((inv) => (
        <div key={inv.id} className="panel">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-bold">{inv.company_name || "Компания"}</h3>
              <p className="mt-1 text-sm">{inv.message}</p>
              <p className="mt-2 font-semibold text-[var(--brand)]">
                {inv.salary_from.toLocaleString("ru-RU")} – {inv.salary_to.toLocaleString("ru-RU")} ₽
              </p>
              {inv.reason && <p className="muted mt-1 text-xs">Почему вы: {inv.reason}</p>}
            </div>
            <span className="badge">{inv.status}</span>
          </div>
          {(inv.status === "sent" || inv.status === "viewed") && (
            <div className="mt-4 flex gap-2">
              <button className="btn btn-ok" onClick={() => respond(inv.id, "accepted")}>
                Принять
              </button>
              <button className="btn btn-danger" onClick={() => respond(inv.id, "declined")}>
                Отклонить
              </button>
            </div>
          )}
          {inv.status === "accepted" && (
            <div className="mt-4">
              <button className="btn btn-danger" onClick={() => revokeContacts(inv.id)}>
                Отозвать доступ к контактам
              </button>
              <p className="muted mt-1 text-xs">По 152-ФЗ можно закрыть телефон/email для работодателя</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
