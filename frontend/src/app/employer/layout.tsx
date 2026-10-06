"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { clearAuth, getRole } from "@/lib/api";

const links = [
  { href: "/employer", label: "Обзор" },
  { href: "/employer/company", label: "Компания" },
  { href: "/employer/needs", label: "Потребность" },
  { href: "/employer/match", label: "Подборка" },
  { href: "/employer/invitations", label: "Приглашения" },
];

export default function EmployerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const role = getRole();
    if (!role) router.replace("/login");
    else if (role !== "employer") router.replace("/candidate");
  }, [router]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm font-bold text-[var(--brand)]">
            FSP Match
          </Link>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)" }}>
            Кабинет работодателя
          </h1>
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
      <nav className="mb-6 flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`badge ${pathname === l.href ? "!bg-[var(--brand)] !text-white" : ""}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
