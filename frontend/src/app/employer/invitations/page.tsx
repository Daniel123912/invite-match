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

interface InboxItem {
  invitation_id: number;
  peer_label: string;
  peer_role: string;
  last_body?: string | null;
  last_at?: string | null;
  unread_count: number;
  status: string;
}

interface InboxSummary {
  total_unread: number;
  items: InboxItem[];
}

function initials(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function canChat(status: string) {
  return status === "sent" || status === "viewed" || status === "accepted";
}

export default function EmployerInvitationsPage() {
  const [items, setItems] = useState<Invitation[] | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  async function loadInbox() {
    try {
      const data = await api<InboxSummary>("/api/chat/inbox");
      setInbox(data.items || []);
    } catch {
      /* inbox optional for list previews */
    }
  }

  async function load() {
    try {
      const rows = await api<Invitation[]>("/api/employer/invitations");
      setItems(rows);
      setError("");
      const params = new URLSearchParams(window.location.search);
      const focusRaw = params.get("id");
      const focusId = focusRaw ? Number(focusRaw) : null;
      setActiveId((prev) => {
        if (focusId && rows.some((r) => r.id === focusId)) return focusId;
        if (prev && rows.some((r) => r.id === prev)) return prev;
        const chatable = rows.find((r) => canChat(r.status));
        return chatable?.id ?? rows[0]?.id ?? null;
      });
      await loadInbox();
    } catch (e) {
      setError(formatApiError(e));
      setItems([]);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => load());
    const onRefresh = () => void loadInbox();
    window.addEventListener("fsp:chat-inbox-refresh", onRefresh);
    window.addEventListener("fsp:chat-new", onRefresh);
    return () => {
      window.removeEventListener("fsp:chat-inbox-refresh", onRefresh);
      window.removeEventListener("fsp:chat-new", onRefresh);
    };
    // load/loadInbox are stable page-local helpers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threads = useMemo(() => {
    if (!items) return [];
    const byId = new Map(inbox.map((i) => [i.invitation_id, i]));
    const q = query.trim().toLowerCase();
    return items
      .map((inv) => {
        const preview = byId.get(inv.id);
        const name = preview?.peer_label || inv.candidate_name || "Кандидат";
        return {
          inv,
          name,
          preview: preview?.last_body || inv.message,
          lastAt: preview?.last_at || null,
          unread: preview?.unread_count || 0,
        };
      })
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.preview.toLowerCase().includes(q))
      .sort((a, b) => {
        const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
        const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return b.inv.id - a.inv.id;
      });
  }, [items, inbox, query]);

  const active = items?.find((i) => i.id === activeId) || null;
  const activeThread = threads.find((t) => t.inv.id === activeId) || null;

  if (items === null && !error) {
    return (
      <div className="fsp-soft-block empty-state">
        <p className="muted">Загрузка сообщений…</p>
      </div>
    );
  }

  return (
    <div className="fsp-msg">
      {error && (
        <div className="fsp-soft-block !py-3">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
        </div>
      )}

      {!items?.length ? (
        <div className="fsp-soft-block empty-state">
          <p className="font-semibold">Приглашений пока нет</p>
          <p className="muted max-w-md text-sm">
            Отправьте оффер из раздела «Поиск кандидатов» — чат появится здесь. Список офферов — в
            «Приглашённые кандидаты».
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/employer/match" className="btn btn-primary">
              Открыть подборку
            </Link>
            <Link href="/employer/invited" className="btn btn-ghost">
              Приглашённые
            </Link>
          </div>
        </div>
      ) : (
        <div className="fsp-msg-shell">
          <aside className="fsp-msg-list" aria-label="Список чатов">
            <label className="fsp-msg-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M16 16.5 20 20.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск чата…"
                aria-label="Поиск чата"
              />
            </label>

            <ul className="fsp-msg-threads">
              {threads.map((t) => {
                const activeThreadItem = t.inv.id === activeId;
                return (
                  <li key={t.inv.id}>
                    <button
                      type="button"
                      className={`fsp-msg-thread${activeThreadItem ? " active" : ""}`}
                      onClick={() => setActiveId(t.inv.id)}
                    >
                      <div className="fsp-msg-avatar" aria-hidden>
                        {initials(t.name)}
                      </div>
                      <div className="fsp-msg-thread-body">
                        <div className="fsp-msg-thread-top">
                          <span className="fsp-msg-thread-name">{t.name}</span>
                          {t.unread > 0 && <span className="badge">{t.unread}</span>}
                        </div>
                        <p className="fsp-msg-thread-preview">{t.preview}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
              {threads.length === 0 && (
                <li className="fsp-msg-thread empty">
                  <p className="muted text-sm">Ничего не найдено</p>
                </li>
              )}
            </ul>
          </aside>

          <section className="fsp-msg-window">
            {active && activeThread ? (
              <>
                {canChat(active.status) ? (
                  <ChatPanel
                    invitationId={active.id}
                    variant="messenger"
                    peerName={activeThread.name}
                    statusLabel={
                      active.status === "accepted"
                        ? "в сети"
                        : labelInviteStatus(active.status)
                    }
                    onRead={() => void loadInbox()}
                  />
                ) : (
                  <div className="fsp-msg-empty">
                    <div className="fsp-msg-avatar lg" aria-hidden>
                      {initials(activeThread.name)}
                    </div>
                    <p className="font-semibold">{activeThread.name}</p>
                    <p className="muted text-sm">Чат недоступен для этого статуса</p>
                  </div>
                )}

                <div className="fsp-msg-offer">
                  <div className="fsp-msg-offer-top">
                    <div>
                      <p className="fsp-msg-offer-title">Приглашение</p>
                      <p className="muted text-sm leading-relaxed">{active.message}</p>
                      <p className="mt-2 text-base font-bold text-[var(--brand)]">
                        {active.salary_from.toLocaleString("ru-RU")} –{" "}
                        {active.salary_to.toLocaleString("ru-RU")} ₽{" "}
                        <span className="text-sm font-semibold text-[var(--muted)]">
                          {active.salary_gross === false
                            ? "(на руки / net)"
                            : "(до вычета НДФЛ / gross)"}
                        </span>
                      </p>
                      <ContactMasks
                        className="mt-2"
                        revealed={Boolean(active.contacts_revealed)}
                        revoked={Boolean(active.contacts_revoked)}
                        phone={active.candidate_phone}
                        email={active.candidate_email}
                        telegram={active.candidate_telegram}
                        phoneDisplay={active.phone_display}
                        emailDisplay={active.email_display}
                        telegramDisplay={active.telegram_display}
                      />
                      <Link
                        href={`/employer/candidates/${active.candidate_id}`}
                        className="mt-2 inline-block text-xs font-semibold text-[var(--brand)] underline"
                      >
                        Изучить профиль
                      </Link>
                    </div>
                    <span className={`badge ${inviteStatusClass(active.status)}`}>
                      {labelInviteStatus(active.status)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="fsp-msg-empty">
                <p className="muted text-sm">Выберите чат слева</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
