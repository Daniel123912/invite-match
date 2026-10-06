"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

interface Candidate {
  id: number;
  full_name: string;
  city?: string;
  stack?: string;
  test_score?: number;
  fsp_score: number;
  has_fsp_history: boolean;
  rank_score?: number;
  reason?: string;
}

interface MatchResponse {
  category: { title: string; candidates_count: number };
  candidates: Candidate[];
}

export default function MatchPage() {
  const [specialization, setSpecialization] = useState("backend");
  const [grade, setGrade] = useState("middle");
  const [stack, setStack] = useState("Python");
  const [data, setData] = useState<MatchResponse | null>(null);
  const [inviteFor, setInviteFor] = useState<number | null>(null);
  const [message, setMessage] = useState("Приглашаем вас на собеседование");
  const [salaryFrom, setSalaryFrom] = useState(200000);
  const [salaryTo, setSalaryTo] = useState(350000);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    setOk("");
    try {
      const qs = new URLSearchParams({ specialization, grade });
      if (stack) qs.set("stack", stack);
      setData(await api<MatchResponse>(`/api/employer/match?${qs}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function sendInvite(candidateId: number) {
    setError("");
    try {
      await api("/api/employer/invitations", {
        method: "POST",
        body: JSON.stringify({
          candidate_id: candidateId,
          message,
          salary_from: salaryFrom,
          salary_to: salaryTo,
        }),
      });
      setOk("Приглашение отправлено");
      setInviteFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="panel grid gap-3 md:grid-cols-4">
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
          <label>Стек (фильтр)</label>
          <input value={stack} onChange={(e) => setStack(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button className="btn btn-primary w-full">Найти</button>
        </div>
      </form>

      {error && <p className="text-[var(--danger)]">{error}</p>}
      {ok && <p className="text-[var(--ok)]">{ok}</p>}

      {data && (
        <>
          <div className="panel">
            <h2 className="text-xl font-bold">{data.category.title}</h2>
            <p className="muted text-sm">
              В категории: {data.category.candidates_count} · показано: {data.candidates.length}
            </p>
            <p className="muted mt-1 text-xs">
              Ранг = тест×0.7 + ФСП×0.3. Контакты скрыты до accept.
            </p>
          </div>

          {data.candidates.map((c) => (
            <div key={c.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{c.full_name}</h3>
                  <p className="muted text-sm">
                    {c.city || "—"} · {c.stack || "стек не указан"}
                  </p>
                  <p className="mt-2 text-sm">
                    Ранг <strong>{c.rank_score}</strong> · тест {c.test_score ?? "—"}% · ФСП{" "}
                    {c.has_fsp_history ? c.fsp_score : "нет истории"}
                  </p>
                  <p className="muted mt-1 text-xs">{c.reason}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setInviteFor(c.id)}>
                  Пригласить
                </button>
              </div>

              {inviteFor === c.id && (
                <div className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4 md:grid-cols-2">
                  <div className="field md:col-span-2">
                    <label>Сообщение</label>
                    <textarea
                      rows={2}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Зарплата от</label>
                    <input
                      type="number"
                      value={salaryFrom}
                      onChange={(e) => setSalaryFrom(Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Зарплата до</label>
                    <input
                      type="number"
                      value={salaryTo}
                      onChange={(e) => setSalaryTo(Number(e.target.value))}
                    />
                  </div>
                  <button className="btn btn-ok" onClick={() => sendInvite(c.id)}>
                    Отправить
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
