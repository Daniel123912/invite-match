"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { clearAuth, getRole } from "@/lib/api";

const links = [
  { href: "/candidate", label: "Обзор", exact: true },
  { href: "/candidate/profile", label: "Профиль" },
  { href: "/candidate/survey", label: "Опрос" },
  { href: "/candidate/test", label: "Тест" },
  { href: "/candidate/invitations", label: "Приглашения" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function CandidateLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const role = getRole();
    if (!role) router.replace("/login");
    else if (role !== "candidate") router.replace("/employer");
  }, [router]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-7 md:px-8 md:py-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm font-bold tracking-wide text-[var(--brand)] transition hover:text-[var(--brand-dark)]"
          >
            FSP Match
          </Link>
          <h1
            className="mt-1 text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            Кабинет кандидата
          </h1>
          <p className="muted mt-1 max-w-xl text-sm">
            Профиль → опрос → тест → категория → приглашения от работодателей
          </p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => {
            clearAuth();
            router.push("/");
          }}
        >
          Выйти
        </button>
      </header>

      <div className="cabinet-shell">
        <aside className="panel !p-3">
          <nav className="cabinet-nav" aria-label="Разделы кабинета">
            {links.map((l) => {
              const active = isActive(pathname, l.href, l.exact);
              return (
                <Link key={l.href} href={l.href} className={active ? "active" : ""}>
                  <span>{l.label}</span>
                  {active && <span className="status-dot brand" aria-hidden />}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
