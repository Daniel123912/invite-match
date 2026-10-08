"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { GRADES, SPECIALIZATIONS } from "@/lib/labels";

interface Candidate {
  id: number;
  full_name: string;
  city?: string;
  stack?: string;
  test_score?: number;
  fsp_score: number;
  has_fsp_history: boolean;
  grade_confirmed?: boolean;
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
  const [fspOnly, setFspOnly] = useState(false);
  const [data, setData] = useState<MatchResponse | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteFor, setInviteFor] = useState<number | null>(null);
  const [employerTasks, setEmployerTasks] = useState<{ id: number; title: string }[]>([]);
  const [taskId, setTaskId] = useState<number | "">("");
  const [message, setMessage] = useState("Приглашаем вас на собеседование");
  const [salaryFrom, setSalaryFrom] = useState(200000);
  const [salaryTo, setSalaryTo] = useState(350000);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    api<{ id: number; title: string }[]>("/api/employer/tasks")
      .then(setEmployerTasks)
      .catch(() => setEmployerTasks([]));

    const params = new URLSearchParams(window.location.search);
    const s = params.get("specialization");
    const g = params.get("grade");
    const st = params.get("stack");
    if (s) setSpecialization(s);
    if (g) setGrade(g);
    if (st) setStack(st);
    if (s && g) {
      void runSearch(s, g, st || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(spec: string, gr: string, st: string, onlyFsp: boolean) {
    setError("");
    setOk("");
    setLoading(true);
    setSearched(true);
    try {
      const qs = new URLSearchParams({ specialization: spec, grade: gr });
      if (st) qs.set("stack", st);
      if (onlyFsp) qs.set("fsp_only", "true");
      setData(await api<MatchResponse>(`/api/employer/match?${qs}`));
    } catch (err) {
      setData(null);
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function search(e?: FormEvent) {
    e?.preventDefault();
    await runSearch(specialization, grade, stack, fspOnly);
  }

  async function sendInvite(candidateId: number) {
    setError("");
    setOk("");
    try {
      await api("/api/employer/invitations", {
        method: "POST",
        body: {
          candidate_id: candidateId,
          message,
          salary_from: salaryFrom,
          salary_to: salaryTo,
          ...(taskId ? { employer_task_id: taskId } : {}),
        },
      });
      setOk("Приглашение отправлено");
      setInviteFor(null);
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="section-title text-xl">Подборка кандидатов</h2>
        <p className="muted mt-1 text-sm">
          Выберите категорию → увидите ранжированный список с обоснованием → пригласите с зарплатой
        </p>
      </div>

      <form onSubmit={search} className="panel grid gap-3 md:grid-cols-4">
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
          <label>Стек (фильтр)</label>
          <input value={stack} onChange={(e) => setStack(e.target.value)} placeholder="Python" />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fspOnly}
              onChange={(e) => setFspOnly(e.target.checked)}
            />
            Только с ФСП
          </label>
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Ищем…" : "Найти"}
          </button>
        </div>
      </form>

      {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
      {ok && <p className="text-sm font-semibold text-[var(--ok)]">{ok}</p>}

      {loading && (
        <div className="panel empty-state">
          <p className="muted">Ищем кандидатов…</p>
        </div>
      )}

      {!loading && searched && data && data.candidates.length === 0 && (
        <div className="panel empty-state">
          <p className="section-title text-lg">В категории пока нет кандидатов</p>
          <p className="muted max-w-md text-sm">
            Попробуйте другой грейд/специализацию или создайте потребность — кандидаты появятся после
            прохождения теста.
          </p>
          <Link href="/employer/needs" className="btn btn-ghost mt-2">
            К потребности
          </Link>
        </div>
      )}

      {!loading && searched && !data && !error && (
        <div className="panel empty-state">
          <p className="muted text-sm">Нет данных — нажмите «Найти»</p>
        </div>
      )}

      {!loading && data && data.candidates.length > 0 && (
        <>
          <div className="panel">
            <h2 className="section-title text-xl">{data.category.title}</h2>
            <p className="muted text-sm">
              В категории: {data.category.candidates_count} · показано: {data.candidates.length}
            </p>
            <p className="muted mt-1 text-xs">
              Ранг = тест×0.7 + ФСП×0.3. Неподтверждённый грейд ниже. Контакты скрыты до accept.
            </p>
          </div>

          {data.candidates.map((c) => (
            <div key={c.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{c.full_name}</h3>
                    {c.grade_confirmed === false && (
                      <span className="badge !bg-[var(--warn-soft)] !text-[var(--warn)]">
                        Грейд не подтверждён
                      </span>
                    )}
                  </div>
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
                    <label>Зарплата от, ₽</label>
                    <input
                      type="number"
                      value={salaryFrom}
                      onChange={(e) => setSalaryFrom(Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Зарплата до, ₽</label>
                    <input
                      type="number"
                      value={salaryTo}
                      onChange={(e) => setSalaryTo(Number(e.target.value))}
                    />
                  </div>
                  <div className="field md:col-span-2">
                    <label>Задание кандидату (опционально)</label>
                    <select
                      value={taskId}
                      onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">Без задания</option>
                      {employerTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          #{t.id} · {t.title}
                        </option>
                      ))}
                    </select>
                    <p className="muted text-xs">
                      Появится у кандидата в разделе «Задания» сразу после отправки приглашения
                    </p>
                  </div>
                  <button className="btn btn-ok" onClick={() => sendInvite(c.id)}>
                    Отправить приглашение
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {!loading && !searched && (
        <div className="panel empty-state">
          <p className="section-title text-lg">Выберите категорию и нажмите «Найти»</p>
          <p className="muted text-sm">
            Или сначала{" "}
            <Link href="/employer/needs" className="link-quiet font-semibold text-[var(--brand)]">
              опишите потребность
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
