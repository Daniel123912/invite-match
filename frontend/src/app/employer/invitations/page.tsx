"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

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
}

export default function EmployerInvitationsPage() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Invitation[]>("/api/employer/invitations")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!items.length) return <div className="panel muted">Исходящих приглашений пока нет</div>;

  return (
    <div className="space-y-3">
      {items.map((inv) => (
        <div key={inv.id} className="panel">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <h3 className="font-bold">{inv.candidate_name}</h3>
              <p className="mt-1 text-sm">{inv.message}</p>
              <p className="mt-2 font-semibold text-[var(--brand)]">
                {inv.salary_from.toLocaleString("ru-RU")} – {inv.salary_to.toLocaleString("ru-RU")} ₽
              </p>
              {inv.status === "accepted" && (
                <p className="mt-2 text-sm text-[var(--ok)]">
                  Контакты: {inv.candidate_email || "—"} · {inv.candidate_phone || "—"} ·{" "}
                  {inv.candidate_telegram || "—"}
                </p>
              )}
              {inv.status !== "accepted" && (
                <p className="muted mt-2 text-xs">Контакты скрыты до принятия приглашения</p>
              )}
            </div>
            <span className="badge">{inv.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
