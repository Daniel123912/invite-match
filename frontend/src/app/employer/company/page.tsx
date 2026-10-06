"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Company {
  id?: number;
  name: string;
  description?: string;
  website?: string;
  industry?: string;
  city?: string;
}

export default function CompanyPage() {
  const [form, setForm] = useState<Company>({
    name: "",
    description: "",
    website: "",
    industry: "it",
    city: "",
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Company | null>("/api/employer/company")
      .then((c) => {
        if (c) setForm(c);
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const saved = await api<Company>("/api/employer/company", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setForm(saved);
      setMsg("Сохранено");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel grid max-w-2xl gap-4">
      <h2 className="text-xl font-bold">Профиль компании</h2>
      <div className="field">
        <label>Название</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Сайт</label>
        <input
          value={form.website || ""}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Город</label>
        <input
          value={form.city || ""}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Описание</label>
        <textarea
          rows={4}
          value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      {msg && <p className="text-[var(--ok)]">{msg}</p>}
      {error && <p className="text-[var(--danger)]">{error}</p>}
      <button className="btn btn-primary">Сохранить</button>
    </form>
  );
}
