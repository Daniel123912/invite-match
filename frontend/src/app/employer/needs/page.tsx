"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { GRADES, SPECIALIZATIONS, labelGrade, labelSpec } from "@/lib/labels";

interface Need {
  id: number;
  title: string;
  specialization: string;
  grade: string;
  stack?: string;
  salary_from: number;
  salary_to: number;
  is_suspicious?: boolean;
}

export default function NeedsPage() {
  const [items, setItems] = useState<Need[] | null>(null);
  const [title, setTitle] = useState("Backend Middle");
  const [specialization, setSpecialization] = useState("backend");
  const [grade, setGrade] = useState("middle");
  const [stack, setStack] = useState("Python, FastAPI");
  const [salaryFrom, setSalaryFrom] = useState(200000);
  const [salaryTo, setSalaryTo] = useState(350000);
  const [description, setDescription] = useState(
    "Ищем разработчика для продуктовой команды: API, интеграции, код-ревью.",
  );
  const [salaryGross, setSalaryGross] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [lastCreated, setLastCreated] = useState<{
    id: number;
    specialization: string;
    grade: string;
    stack?: string;
  } | null>(null);

  async function load() {
    setItems(await api<Need[]>("/api/employer/needs"));
  }

  useEffect(() => {
    load().catch((e) => {
      setError(formatApiError(e));
      setItems([]);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      const created = await api<{ id: number }>("/api/employer/needs", {
        method: "POST",
        body: {
          title,
          specialization,
          grade,
          stack,
          description,
          salary_from: salaryFrom,
          salary_to: salaryTo,
          salary_gross: salaryGross,
        },
      });
      setLastCreated({ id: created.id, specialization, grade, stack });
      setOk("Потребность создана — откройте подборку");
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  const matchHref = lastCreated
    ? `/employer/match?need_id=${lastCreated.id}&specialization=${lastCreated.specialization}&grade=${lastCreated.grade}&stack=${encodeURIComponent(lastCreated.stack || "")}`
    : "/employer/match";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="panel space-y-3">
        <h2 className="section-title text-xl">Кого ищем</h2>
        <p className="muted text-sm">Опишите потребность — потом найдёте категорию в подборке</p>
        <div className="field">
          <label>Заголовок</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Специализация</label>
          <select value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
            {SPECIALIZATIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Грейд</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            {GRADES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Стек</label>
          <input value={stack} onChange={(e) => setStack(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label>Зарплата от, ₽</label>
            <input
              type="number"
              value={salaryFrom}
              onChange={(e) => setSalaryFrom(Number(e.target.value))}
              required
            />
          </div>
          <div className="field">
            <label>Зарплата до, ₽</label>
            <input
              type="number"
              value={salaryTo}
              onChange={(e) => setSalaryTo(Number(e.target.value))}
              required
            />
          </div>
        </div>
        <div className="field">
          <label>Описание (мин. 20 символов)</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={20}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={salaryGross}
            onChange={(e) => setSalaryGross(e.target.checked)}
          />
          Зарплата до вычета НДФЛ (gross)
        </label>
        {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
        {ok && (
          <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--ok-soft)] px-3 py-2">
            <p className="text-sm font-semibold text-[var(--ok)]">{ok}</p>
            <Link href={matchHref} className="btn btn-primary mt-2">
              Открыть подборку →
            </Link>
          </div>
        )}
        <button className="btn btn-primary">Создать</button>
      </form>

      <div className="space-y-3">
        <h2 className="section-title text-xl">Мои потребности</h2>
        {items === null && <p className="muted text-sm">Загрузка…</p>}
        {items && !items.length && (
          <div className="panel empty-state">
            <p className="font-semibold">Пока пусто</p>
            <p className="muted text-sm">Создайте первую потребность слева</p>
          </div>
        )}
        {items?.map((n) => (
          <div key={n.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{n.title}</p>
                <p className="muted text-sm">
                  {labelSpec(n.specialization)} × {labelGrade(n.grade)} · {n.stack || "стек не указан"}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--brand)]">
                  {n.salary_from.toLocaleString("ru-RU")} – {n.salary_to.toLocaleString("ru-RU")} ₽
                </p>
                {n.is_suspicious && (
                  <p className="mt-1 text-xs font-semibold text-[var(--danger)]">Скрыта из-за жалоб</p>
                )}
              </div>
              <Link
                href={`/employer/match?need_id=${n.id}&specialization=${n.specialization}&grade=${n.grade}&stack=${encodeURIComponent(n.stack || "")}`}
                className="btn btn-ghost"
              >
                Подборка
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
