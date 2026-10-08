"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { clearAuth, getRole } from "@/lib/api";

const primary = [
  { href: "/candidate", label: "Обзор", exact: true },
  { href: "/candidate/profile", label: "Профиль" },
  { href: "/candidate/survey", label: "Опрос" },
  { href: "/candidate/test", label: "Тест" },
  { href: "/candidate/invitations", label: "Приглашения" },
];

const extra = [
  { href: "/candidate/tasks", label: "Задания" },
  { href: "/candidate/vacancies", label: "Вакансии" },
  { href: "/candidate/sandbox", label: "Песочница" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  items,
  pathname,
}: {
  items: { href: string; label: string; exact?: boolean }[];
  pathname: string;
}) {
  return (
    <>
      {items.map((l) => {
        const active = isActive(pathname, l.href, l.exact);
        return (
          <Link key={l.href} href={l.href} className={active ? "active" : ""}>
            <span>{l.label}</span>
            {active && <span className="status-dot brand" aria-hidden />}
          </Link>
        );
      })}
    </>
  );
}

export default function CandidateLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const role = getRole();
    if (!role) {
      router.replace("/login");
      return;
    }
    if (role !== "candidate") {
      router.replace("/employer");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="page-enter mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-5 py-16">
        <p className="muted text-sm">Загрузка кабинета…</p>
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-7 md:px-8 md:py-10">
      <header className="cabinet-header">
        <div>
          <Link href="/" className="cabinet-brand">
            FSP Match
          </Link>
          <h1 className="cabinet-title">Кабинет кандидата</h1>
          <p className="muted mt-1.5 max-w-xl text-sm">
            Профиль → опрос → тест → категория → приглашения
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationBell />
          <button
            className="btn btn-ghost"
            onClick={() => {
              clearAuth();
              router.push("/");
            }}
          >
            Выйти
          </button>
        </div>
      </header>

      <div className="cabinet-shell">
        <aside className="panel panel-solid !p-3">
          <nav className="cabinet-nav" aria-label="Разделы кабинета">
            <p className="nav-group-label">Основное</p>
            <NavLinks items={primary} pathname={pathname} />
            <p className="nav-group-label mt-3">Дополнительно</p>
            <NavLinks items={extra} pathname={pathname} />
          </nav>
        </aside>
        <main className="min-w-0 page-enter">{children}</main>
      </div>
    </div>
  );
}
