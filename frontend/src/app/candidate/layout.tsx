"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useCallback } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { CabinetAuthGate } from "@/components/CabinetAuthGate";
import { NotificationBell } from "@/components/NotificationBell";
import { recordCandidateVisit } from "@/lib/achievements";
import { clearAuth } from "@/lib/api";

const primary = [
  { href: "/candidate/profile", label: "Мой профиль" },
  { href: "/candidate/work", label: "Тесты и задания" },
  { href: "/candidate/invitations", label: "Сообщения" },
  { href: "/candidate", label: "Достижения", exact: true },
  { href: "/candidate/settings", label: "Настройки" },
];

const extra = [
  { href: "/candidate/survey", label: "Опрос" },
  { href: "/candidate/test", label: "Тест категории" },
  { href: "/candidate/tasks", label: "Задания" },
  { href: "/candidate/vacancies", label: "Вакансии" },
  { href: "/candidate/sandbox", label: "Песочница" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  if (href === "/candidate/work") {
    return (
      pathname === "/candidate/work" ||
      pathname.startsWith("/candidate/work/") ||
      pathname === "/candidate/test" ||
      pathname.startsWith("/candidate/test/") ||
      pathname === "/candidate/tasks" ||
      pathname.startsWith("/candidate/tasks/") ||
      pathname === "/candidate/sandbox" ||
      pathname.startsWith("/candidate/sandbox/")
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

export default function CandidateLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const onAuthorized = useCallback(() => {
    recordCandidateVisit(localStorage.getItem("user_id"));
  }, []);

  return (
    <CabinetAuthGate expected="candidate" onAuthorized={onAuthorized}>
      <div className="fsp-cabinet page-enter flex w-full flex-1 flex-col">
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
    </CabinetAuthGate>
  );
}
