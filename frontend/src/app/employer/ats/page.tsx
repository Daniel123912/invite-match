"use client";

import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { labelInviteStatus } from "@/lib/labels";

interface Invitation {
  id: number;
  candidate_name?: string;
  status: string;
}

export default function AtsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationId, setInvitationId] = useState<number | "">("");
  const [exportJson, setExportJson] = useState("");
  const [webhookMsg, setWebhookMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Invitation[]>("/api/employer/invitations")
      .then((list) => {
        setInvitations(list);
        if (list.length) setInvitationId(list[0].id);
      })
      .catch(() => setInvitations([]));
  }, []);

  async function exportAts() {
    if (!invitationId) return;
    setError("");
    setBusy(true);
    try {
      const data = await api<{ payload: Record<string, unknown> }>(
        `/api/employer/ats/export?invitation_id=${invitationId}`,
      );
      setExportJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendWebhook() {
    if (!invitationId) return;
    setError("");
    setWebhookMsg("");
    setBusy(true);
    try {
      const r = await api<{ ok: boolean }>("/api/employer/ats/webhook", {
        method: "POST",
        body: {
          event: "invitation.accepted",
          invitation_id: invitationId,
          payload: { demo: true },
        },
      });
      setWebhookMsg(r.ok ? "Webhook принят (лог на сервере)" : "Ошибка");
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel grid max-w-2xl gap-4">
      <div>
        <h2 className="section-title text-xl">Интеграция ATS (заглушка)</h2>
        <p className="muted text-sm">
          Демо-экспорт кандидата в JSON и приём webhook для внешней ATS. Не обязательный MVP.
        </p>
      </div>
      <div className="field">
        <label>Приглашение</label>
        {invitations.length ? (
          <select
            value={invitationId}
            onChange={(e) => setInvitationId(Number(e.target.value))}
          >
            {invitations.map((inv) => (
              <option key={inv.id} value={inv.id}>
                #{inv.id} · {inv.candidate_name || "кандидат"} · {labelInviteStatus(inv.status)}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            value={invitationId}
            onChange={(e) => setInvitationId(e.target.value ? Number(e.target.value) : "")}
            placeholder="ID приглашения"
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={busy || !invitationId} onClick={exportAts}>
          Экспорт
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy || !invitationId} onClick={sendWebhook}>
          Тест webhook
        </button>
      </div>
      {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
      {webhookMsg && <p className="text-sm font-semibold text-[var(--ok)]">{webhookMsg}</p>}
      {exportJson && (
        <pre className="overflow-auto rounded-xl bg-[var(--bg)] p-3 text-xs">{exportJson}</pre>
      )}
    </div>
  );
}
