"use client";

import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";

interface Need {
  id: number;
  title: string;
  company_name: string;
  company_verified: boolean;
  description?: string;
  salary_from: number;
  salary_to: number;
  salary_gross: boolean;
  is_suspicious: boolean;
}

export default function VacanciesPage() {
  const [items, setItems] = useState<Need[] | null>(null);
  const [reason, setReason] = useState("Подозрение на фиктивную вакансию без деталей");
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    api<Need[]>("/api/candidate/needs/public")
      .then(setItems)
      .catch((e) => {
        setError(formatApiError(e));
        setItems([]);
      });
  }, []);

  async function report(id: number) {
    setMsg("");
    setMsgOk(false);
    setBusyId(id);
    try {
      await api(`/api/candidate/needs/${id}/report`, { method: "POST", body: { reason } });
      setMsg("Жалоба отправлена");
      setMsgOk(true);
      setItems(await api<Need[]>("/api/candidate/needs/public"));
    } catch (e) {
      setMsg(formatApiError(e));
      setMsgOk(false);
    } finally {
      setBusyId(null);
    }
  }

  if (items === null) {
    return (
      <div className="panel empty-state">
        <p className="muted">Загрузка вакансий…</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="section-title text-xl">Потребности работодателей</h2>
        <p className="muted text-sm">
          Публичный каталог (без импорта чужих площадок). Можно пожаловаться на фиктивную.
        </p>
      </div>

      <div className="field max-w-xl">
        <label>Причина жалобы</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
      {msg && (
        <p className={`text-sm font-semibold ${msgOk ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>
          {msg}
        </p>
      )}

      {!items.length ? (
        <div className="panel empty-state">
          <p className="font-semibold">Пока нет опубликованных потребностей</p>
          <p className="muted text-sm">Работодатели появятся здесь после создания вакансий</p>
        </div>
      ) : (
        items.map((n) => (
          <article key={n.id} className="panel">
            <div className="flex flex-wrap gap-2">
              <h3 className="font-bold">{n.title}</h3>
              {n.company_verified && <span className="badge badge-ok">Компания проверена</span>}
            </div>
            <p className="muted text-sm">{n.company_name}</p>
            <p className="mt-2 text-sm">{n.description}</p>
            <p className="mt-2 font-semibold text-[var(--brand)]">
              {n.salary_from.toLocaleString("ru-RU")} – {n.salary_to.toLocaleString("ru-RU")} ₽{" "}
              {n.salary_gross ? "(gross)" : "(net)"}
            </p>
            <button
              type="button"
              className="btn btn-danger mt-3"
              disabled={busyId === n.id}
              onClick={() => report(n.id)}
            >
              Пожаловаться
            </button>
          </article>
        ))
      )}
    </div>
  );
}
