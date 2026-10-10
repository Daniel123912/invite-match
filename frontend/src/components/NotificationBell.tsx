"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, formatApiError, getRole } from "@/lib/api";
import { formatDateTime } from "@/lib/labels";

interface InboxItem {
  invitation_id: number;
  peer_label: string;
  peer_role: string;
  last_body?: string | null;
  last_at?: string | null;
  last_sender_role?: string | null;
  unread_count: number;
  status: string;
}

interface InboxSummary {
  total_unread: number;
  items: InboxItem[];
}

interface Toast {
  id: number;
  title: string;
  body: string;
  href: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<InboxSummary | null>(null);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const prevUnread = useRef<number | null>(null);
  const role = getRole();
  const invitationsHref = role === "employer" ? "/employer/invitations" : "/candidate/invitations";
  const fromLabel =
    role === "candidate" ? "Сообщение от работодателя" : "Сообщение от кандидата";

  const pushToast = useCallback(
    (body: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) =>
        [{ id, title: fromLabel, body, href: invitationsHref }, ...prev].slice(0, 3),
      );
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 6000);
    },
    [fromLabel, invitationsHref],
  );

  const refresh = useCallback(async () => {
    try {
      const next = await api<InboxSummary>("/api/chat/inbox");
      if (prevUnread.current != null && next.total_unread > prevUnread.current) {
        const hot = next.items.find((i) => i.unread_count > 0);
        pushToast(hot?.last_body || "Новое сообщение в чате");
      }
      prevUnread.current = next.total_unread;
      setData(next);
      setError("");
    } catch (e) {
      setError(formatApiError(e, "Не удалось загрузить уведомления"));
    }
  }, [pushToast]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 10000);
    const onRefresh = () => void refresh();
    window.addEventListener("fsp:chat-inbox-refresh", onRefresh);
    window.addEventListener("fsp:chat-new", onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("fsp:chat-inbox-refresh", onRefresh);
      window.removeEventListener("fsp:chat-new", onRefresh);
    };
  }, [refresh]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const unread = data?.total_unread ?? 0;
  const withMessages = data?.items ?? [];

  return (
    <>
      <div className="notif-root" ref={rootRef}>
        <button
          type="button"
          className="notif-bell"
          aria-label="Уведомления о сообщениях"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 9a6 6 0 1 1 12 0c0 3.5 1.5 5 2 6H4c.5-1 2-2.5 2-6Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M10 19a2 2 0 0 0 4 0"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
        </button>

        {open && (
          <div className="notif-dropdown panel panel-solid">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
              <p className="section-title text-sm">Сообщения</p>
              <Link href={invitationsHref} className="link-quiet text-xs" onClick={() => setOpen(false)}>
                Все чаты
              </Link>
            </div>
            {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
            {!error && !withMessages.length && (
              <p className="muted mt-3 text-xs">Пока нет переписок</p>
            )}
            <ul className="notif-list">
              {withMessages.map((item) => (
                <li key={item.invitation_id}>
                  <Link
                    href={invitationsHref}
                    onClick={() => setOpen(false)}
                    className={item.unread_count ? "has-unread" : ""}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{item.peer_label}</span>
                      {item.unread_count > 0 && (
                        <span className="badge !px-1.5 !py-0.5">{item.unread_count}</span>
                      )}
                    </div>
                    <p className="muted mt-0.5 line-clamp-2 text-xs">{item.last_body}</p>
                    <p className="muted mt-1 text-[11px]">{formatDateTime(item.last_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <Link key={t.id} href={t.href} className="toast-card" onClick={() => setToasts([])}>
            <p className="font-semibold text-sm">{t.title}</p>
            <p className="muted mt-0.5 line-clamp-2 text-xs">{t.body}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
