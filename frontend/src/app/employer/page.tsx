"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";

interface Category {
  id: number;
  title: string;
  candidates_count: number;
  specialization?: string;
  grade?: string;
}

export default function EmployerHome() {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Category[]>("/api/employer/categories")
      .then(setCats)
      .catch((e) => {
        setError(formatApiError(e));
        setCats([]);
      });
  }, []);

  const top = (cats || [])
    .slice()
    .sort((a, b) => b.candidates_count - a.candidates_count)
    .slice(0, 9);

  return (
    <div className="grid gap-4">
      <section className="fsp-soft-block">
        <p className="badge w-fit">Обратная механика</p>
        <h1 className="fsp-profile-name mt-3">Найдите категорию</h1>
        <p className="muted mt-2 max-w-2xl text-sm leading-relaxed">
          Опишите потребность → увидите категорию и кандидатов с обоснованием → отправьте
          приглашение с зарплатой. Контакты откроются только после принятия.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/employer/company" className="btn btn-ghost">
            1. Профиль
          </Link>
          <Link href="/employer/needs" className="btn btn-primary">
            2. Вакансия
          </Link>
          <Link href="/employer/match" className="btn btn-ghost">
            3. Поиск
          </Link>
          <Link href="/employer/tasks" className="btn btn-ghost">
            4. Проверка решений
          </Link>
        </div>
      </section>

      {error && (
        <div className="fsp-soft-block !py-3">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
          <button className="btn btn-ghost mt-2" onClick={() => window.location.reload()}>
            Повторить
          </button>
        </div>
      )}

      <section className="fsp-soft-block">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="fsp-soft-block-title !mb-0">Категории с кандидатами</h2>
          <p className="muted text-xs">
            {cats === null ? "Загрузка…" : `${cats.length} доступно`}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((c) => (
            <Link
              key={c.id}
              href={
                c.specialization && c.grade
                  ? `/employer/match?specialization=${c.specialization}&grade=${c.grade}`
                  : "/employer/match"
              }
              className="fsp-stat block transition hover:border-[var(--brand)]"
            >
              <p className="font-semibold tracking-tight">{c.title}</p>
              <p className="muted mt-1.5 text-sm">{c.candidates_count} в категории</p>
              <span className="mt-3 inline-block text-sm font-semibold text-[var(--brand)]">
                Открыть подборку →
              </span>
            </Link>
          ))}
          {cats !== null && !cats.length && (
            <div className="fsp-stat empty-state sm:col-span-2 lg:col-span-3">
              <p className="muted text-sm">Категории появятся после заполнения базы (seed)</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
