"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api, formatApiError, getRole } from "@/lib/api";
import { formatDateTime } from "@/lib/labels";

interface Msg {
  id: number;
  sender_role: string;
  sender_user_id: number;
  body: string;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  candidate: "Кандидат",
  employer: "Работодатель",
  admin: "Админ",
};

export function ChatPanel({
  invitationId,
  onRead,
}: {
  invitationId: number;
  onRead?: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const myRole = getRole();
  const bottomRef = useRef<HTMLDivElement>(null);
  const knownIds = useRef<Set<number>>(new Set());

  async function load(opts?: { silent?: boolean }) {
    try {
      const rows = await api<Msg[]>(`/api/chat/${invitationId}`);
      const prev = knownIds.current;
      const arrived = rows.filter((m) => !prev.has(m.id) && m.sender_role !== myRole);
      if (arrived.length && prev.size > 0 && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("fsp:chat-new", {
            detail: { invitationId, count: arrived.length, preview: arrived.at(-1)?.body },
          }),
        );
      }
      knownIds.current = new Set(rows.map((m) => m.id));
      setMessages(rows);
      setError("");
      onRead?.();
      window.dispatchEvent(new CustomEvent("fsp:chat-inbox-refresh"));
    } catch (e) {
      if (!opts?.silent) setError(formatApiError(e, "Не удалось загрузить чат"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    knownIds.current = new Set();
    void load();
    const t = setInterval(() => {
      void load({ silent: true });
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await api(`/api/chat/${invitationId}`, { method: "POST", body: { body: text.trim() } });
      setText("");
      await load();
    } catch (err) {
      setError(formatApiError(err, "Не удалось отправить"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-panel mt-4">
      <div className="chat-panel-head">
        <p className="section-title text-sm">Чат по приглашению</p>
        <span className="muted text-xs">Обновляется автоматически</span>
      </div>
      <div className="chat-thread">
        {loading && <p className="muted text-xs">Загрузка…</p>}
        {!loading && messages.length === 0 && !error && (
          <p className="muted text-xs">Напишите первое сообщение — собеседник увидит уведомление</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_role === myRole;
          return (
            <div key={m.id} className={`chat-bubble ${mine ? "mine" : "theirs"}`}>
              <div className="chat-bubble-meta">
                <span>{mine ? "Вы" : ROLE_LABELS[m.sender_role] || m.sender_role}</span>
                <span>{formatDateTime(m.created_at)}</span>
              </div>
              <p>{m.body}</p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{error}</p>}
      <form onSubmit={send} className="chat-compose">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение…"
          disabled={sending}
          maxLength={4000}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()}>
          {sending ? "…" : "Отправить"}
        </button>
      </form>
    </div>
  );
}
