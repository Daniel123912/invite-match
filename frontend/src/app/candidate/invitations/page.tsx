"use client";

import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { ChatPanel } from "@/components/ChatPanel";
import { inviteStatusClass, labelInviteStatus } from "@/lib/labels";

interface Invitation {
  id: number;
  company_name?: string;
  message: string;
  salary_from: number;
  salary_to: number;
  status: string;
  reason?: string;
  contacts_revoked?: boolean;
  employer_contact_email?: string | null;
  employer_contact_phone?: string | null;
  employer_contact_telegram?: string | null;
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
      setError(formatApiError(e));
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
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
      setError(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function setContactsAccess(id: number, revoke: boolean) {
    setBusyId(id);
    setError("");
    try {
      await api(`/api/candidate/invitations/${id}/contacts`, {
        method: "PATCH",
        body: { revoke },
      });
      await load();
    } catch (e) {
      setError(formatApiError(e));
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
        <h2 className="section-title text-xl">Приглашения</h2>
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
                    {inv.salary_from.toLocaleString("ru-RU")} –{" "}
                    {inv.salary_to.toLocaleString("ru-RU")} ₽
                  </p>
                  {inv.reason && (
                    <p className="muted mt-2 text-xs leading-relaxed">Почему вы: {inv.reason}</p>
                  )}
                  {(inv.employer_contact_email ||
                    inv.employer_contact_phone ||
                    inv.employer_contact_telegram) && (
                    <p className="mt-2 text-xs leading-relaxed">
                      Связь с работодателем:{" "}
                      {[inv.employer_contact_email, inv.employer_contact_phone, inv.employer_contact_telegram]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <span className={`badge ${inviteStatusClass(inv.status)}`}>
                  {labelInviteStatus(inv.status)}
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

              {(inv.status === "sent" || inv.status === "viewed" || inv.status === "accepted") && (
                <ChatPanel invitationId={inv.id} />
              )}

              {inv.status === "accepted" && (
                <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
                  {inv.contacts_revoked ? (
                    <>
                      <p className="text-sm font-semibold text-[var(--warn)]">
                        Доступ к контактам отозван
                      </p>
                      <button
                        className="btn btn-ok mt-2"
                        disabled={busyId === inv.id}
                        onClick={() => setContactsAccess(inv.id, false)}
                      >
                        Вернуть доступ
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-danger"
                        disabled={busyId === inv.id}
                        onClick={() => setContactsAccess(inv.id, true)}
                      >
                        Отозвать доступ к контактам
                      </button>
                      <p className="muted mt-2 text-xs">
                        По 152-ФЗ можно закрыть телефон и email для работодателя
                      </p>
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
