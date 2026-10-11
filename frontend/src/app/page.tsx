"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { cabinetPath, clearAuth, getRole, isAuthenticated, type Role } from "@/lib/api";

export default function HomePage() {
  const [role, setRole] = useState<Role | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setRole(isAuthenticated() ? getRole() : null);
    setChecked(true);
  }, []);

  const cabinet = cabinetPath(role);
  const loggedIn = Boolean(checked && role && cabinet);

  return (
    <main className="hero-shell">
      <div className="hero-glow hero-glow-a" aria-hidden />
      <div className="hero-glow hero-glow-b" aria-hidden />
      <div className="hero-mesh" aria-hidden />

      <div className="hero-content">
        <nav className="mb-auto flex items-center justify-between gap-4 pb-10 pt-2">
          <BrandLogo size="auth" />
          <div className="flex gap-2">
            {loggedIn ? (
              <>
                <Link href={cabinet!} className="btn btn-primary !px-4 !py-2 text-sm">
                  В кабинет
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost !px-4 !py-2 text-sm"
                  onClick={() => {
                    clearAuth();
                    setRole(null);
                  }}
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost !px-4 !py-2 text-sm">
                  Войти
                </Link>
                <Link href="/register" className="btn btn-primary !px-4 !py-2 text-sm">
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </nav>

        <section className="max-w-3xl py-8 md:py-16">
          <h1 className="hero-brand">
            <BrandLogo link={false} size="hero" />
          </h1>
          <p className="hero-lead muted mt-6 max-w-xl text-lg leading-relaxed md:text-xl">
            Категория кандидата — только после опроса и теста. Работодатель находит нужный профиль
            и приглашает с зарплатной вилкой.
          </p>
          <div className="hero-cta mt-10 flex flex-wrap gap-3">
            {loggedIn ? (
              <Link href={cabinet!} className="btn btn-primary !px-6 !py-3.5 text-base">
                Вернуться в кабинет
              </Link>
            ) : (
              <>
                <Link href="/register" className="btn btn-primary !px-6 !py-3.5 text-base">
                  Начать подбор
                </Link>
                <Link href="/login" className="btn btn-ghost !px-6 !py-3.5 text-base">
                  У меня есть аккаунт
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="mt-auto grid gap-4 border-t border-[var(--line)] pt-10 md:grid-cols-2">
          <Link href="/candidate" className="group block py-3 transition hover:translate-x-1">
            <p className="section-title group-hover:text-[var(--brand-dark)]">Кабинет кандидата</p>
            <p className="muted mt-1 text-sm">Профиль → опрос → тест → приглашения</p>
          </Link>
          <Link href="/employer" className="group block py-3 transition hover:translate-x-1">
            <p className="section-title group-hover:text-[var(--brand-dark)]">Кабинет работодателя</p>
            <p className="muted mt-1 text-sm">Потребность → подборка → оффер</p>
          </Link>
        </section>

        {!loggedIn && (
          <aside className="mt-8 text-sm">
            <p className="font-semibold">Демо-аккаунты</p>
            <ul className="muted mt-2 space-y-1">
              <li>
                <code className="text-[var(--ink)]">candidate@demo.ru</code> / demo1234
              </li>
              <li>
                <code className="text-[var(--ink)]">new@demo.ru</code> / demo1234
              </li>
              <li>
                <code className="text-[var(--ink)]">employer@demo.ru</code> / demo1234
              </li>
            </ul>
          </aside>
        )}
      </div>
    </main>
  );
}
