"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Category {
  id: number;
  title: string;
  candidates_count: number;
}

export default function EmployerHome() {
  const [cats, setCats] = useState<Category[]>([]);

  useEffect(() => {
    api<Category[]>("/api/employer/categories").then(setCats).catch(() => setCats([]));
  }, []);

  return (
    <div className="space-y-4">
      <div className="panel">
        <h2 className="text-xl font-bold">Обратная механика</h2>
        <p className="muted mt-2 text-sm">
          Вы описываете потребность → видите категорию → кандидатов с обоснованием → шлёте
          приглашение с зарплатой. Контакты откроются только после accept.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/employer/needs" className="btn btn-primary">
            Описать потребность
          </Link>
          <Link href="/employer/match" className="btn btn-ghost">
            Открыть подборку
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {cats.map((c) => (
          <div key={c.id} className="panel">
            <p className="font-semibold">{c.title}</p>
            <p className="muted mt-1 text-sm">{c.candidates_count} в категории</p>
          </div>
        ))}
      </div>
    </div>
  );
}
