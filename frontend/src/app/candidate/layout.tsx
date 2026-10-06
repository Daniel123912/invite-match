"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { clearAuth, getRole } from "@/lib/api";

const links = [
  { href: "/candidate", label: "Обзор" },
  { href: "/candidate/profile", label: "Профиль" },
  { href: "/candidate/survey", label: "Опрос" },
  { href: "/candidate/test", label: "Тест" },
  { href: "/candidate/invitations", label: "Приглашения" },
];

export default function CandidateLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const role = getRole();
    if (!role) router.replace("/login");
    else if (role !== "candidate") router.replace("/employer");
  }, [router]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm font-bold text-[var(--brand)]">
            FSP Match
          </Link>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)" }}>
            Кабинет кандидата
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
