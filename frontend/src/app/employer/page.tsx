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
      <section className="panel overflow-hidden !p-0">
        <div className="relative px-5 py-6 md:px-7 md:py-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "linear-gradient(120deg, color-mix(in srgb, var(--brand) 14%, white) 0%, transparent 55%), linear-gradient(220deg, color-mix(in srgb, var(--accent) 10%, white) 0%, transparent 45%)",
            }}
          />
          <div className="relative">
            <p className="badge w-fit">Обратная механика</p>
            <h2 className="cabinet-title mt-3 text-2xl md:text-3xl">Найдите категорию</h2>
            <p className="muted mt-2 max-w-2xl text-sm leading-relaxed">
              Опишите потребность → увидите категорию и кандидатов с обоснованием → отправьте
              приглашение с зарплатой. Контакты откроются только после принятия.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/employer/company" className="btn btn-ghost">
                1. Компания
              </Link>
              <Link href="/employer/needs" className="btn btn-primary">
                2. Описать потребность
              </Link>
              <Link href="/employer/match" className="btn btn-ghost">
                3. Подборка
              </Link>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="panel !py-3">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
          <button className="btn btn-ghost mt-2" onClick={() => window.location.reload()}>
            Повторить
          </button>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h3 className="section-title">Категории с кандидатами</h3>
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
              className="panel block transition hover:border-[var(--brand)]"
            >
              <p className="font-semibold tracking-tight">{c.title}</p>
              <p className="muted mt-1.5 text-sm">{c.candidates_count} в категории</p>
              <span className="mt-3 inline-block text-sm font-semibold text-[var(--brand)]">
                Открыть подборку →
              </span>
            </Link>
          ))}
          {cats !== null && !cats.length && (
            <div className="panel empty-state sm:col-span-2 lg:col-span-3">
              <p className="muted text-sm">Категории появятся после заполнения базы (seed)</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
