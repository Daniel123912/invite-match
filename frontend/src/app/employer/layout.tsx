"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { clearAuth, getRole } from "@/lib/api";

const primary = [
  { href: "/employer/company", label: "Мой профиль" },
  { href: "/employer/match", label: "Поиск кандидатов" },
  { href: "/employer/needs", label: "Вакансии" },
  { href: "/employer/vacancies", label: "Мои вакансии" },
  { href: "/employer/invited", label: "Приглашённые кандидаты" },
  { href: "/employer/invitations", label: "Сообщения" },
  { href: "/employer/tasks", label: "Проверка решений" },
  { href: "/employer/ats", label: "Настройки" },
];

const extra = [{ href: "/employer", label: "Обзор", exact: true }];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  if (href === "/employer/match") {
    return (
      pathname === "/employer/match" ||
      pathname.startsWith("/employer/match/") ||
      pathname.startsWith("/employer/candidates/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  items,
  pathname,
  extraClass,
}: {
  items: { href: string; label: string; exact?: boolean }[];
  pathname: string;
  extraClass?: string;
}) {
  return (
    <>
      {items.map((l) => {
        const active = isActive(pathname, l.href, l.exact);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={[active ? "active" : "", extraClass].filter(Boolean).join(" ")}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}

export default function EmployerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const role = getRole();
    if (!role) {
      router.replace("/login");
      return;
    }
    if (role !== "employer") {
      router.replace("/candidate");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="fsp-cabinet page-enter flex flex-1 items-center justify-center">
        <p className="muted text-sm">Загрузка кабинета…</p>
      </div>
    );
  }

  return (
    <div className="fsp-cabinet fsp-cabinet--employer page-enter flex w-full flex-1 flex-col">
      <header className="fsp-topbar">
        <BrandLogo />

        <label className="fsp-topbar-search fsp-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 16.5 20 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input type="search" placeholder="Поиск по кабинету…" aria-label="Поиск" />
        </label>

        <div className="fsp-topbar-actions">
          <NotificationBell />
          <button
            type="button"
            className="fsp-icon-btn"
            aria-label="Выйти"
            title="Выйти"
            onClick={() => {
              clearAuth();
              router.push("/");
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M10 12h9M13 8l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="fsp-shell">
        <aside>
          <nav className="fsp-side-nav" aria-label="Разделы кабинета">
            <NavLinks items={primary} pathname={pathname} />
            <div className="fsp-side-extra">
              <NavLinks items={extra} pathname={pathname} />
            </div>
          </nav>
        </aside>
        <main className="min-w-0 page-enter">{children}</main>
      </div>
    </div>
  );
}
