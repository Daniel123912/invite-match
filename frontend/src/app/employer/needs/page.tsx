"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Need {
  id: number;
  title: string;
  specialization: string;
  grade: string;
  stack?: string;
  salary_from: number;
  salary_to: number;
}

export default function NeedsPage() {
  const [items, setItems] = useState<Need[]>([]);
  const [title, setTitle] = useState("Backend Middle");
  const [specialization, setSpecialization] = useState("backend");
  const [grade, setGrade] = useState("middle");
  const [stack, setStack] = useState("Python, FastAPI");
  const [salaryFrom, setSalaryFrom] = useState(200000);
  const [salaryTo, setSalaryTo] = useState(350000);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setItems(await api<Need[]>("/api/employer/needs"));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/employer/needs", {
        method: "POST",
        body: JSON.stringify({
          title,
          specialization,
          grade,
          stack,
          description,
          salary_from: salaryFrom,
          salary_to: salaryTo,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="panel space-y-3">
        <h2 className="text-xl font-bold">Кого ищем</h2>
        <div className="field">
          <label>Заголовок</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Специализация</label>
          <select value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
            <option value="backend">Backend</option>
            <option value="frontend">Frontend</option>
          </select>
        </div>
        <div className="field">
          <label>Грейд</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="junior">Junior</option>
            <option value="middle">Middle</option>
            <option value="senior">Senior</option>
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
          <label>Описание</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary">Создать</button>
      </form>

      <div className="space-y-3">
        <h2 className="text-xl font-bold">Мои потребности</h2>
        {items.map((n) => (
          <div key={n.id} className="panel">
            <p className="font-semibold">{n.title}</p>
            <p className="muted text-sm">
              {n.specialization} × {n.grade} · {n.stack}
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--brand)]">
              {n.salary_from.toLocaleString("ru-RU")} – {n.salary_to.toLocaleString("ru-RU")} ₽
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
