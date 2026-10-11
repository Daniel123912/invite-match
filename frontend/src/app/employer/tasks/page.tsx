"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import {
  formatDateTime,
  labelTaskStatus,
  labelTaskType,
  taskStatusClass,
} from "@/lib/labels";

interface Task {
  id: number;
  title: string;
  task_type: string;
  prompt: string;
  options?: string[] | null;
}

interface Assignment {
  id: number;
  task_id: number;
  task_title: string;
  task_type: string;
  prompt: string;
  status: string;
  score?: number | null;
  feedback?: string | null;
  candidate_name?: string | null;
  candidate_id?: number | null;
  invitation_id?: number | null;
  submitted_at?: string | null;
  answer_text?: string | null;
  answer_mcq_index?: number | null;
  code_submitted?: string | null;
  options?: string[] | null;
}

type Tab = "review" | "bank";
type ReviewFilter = "all" | "submitted" | "pending" | "graded";

function initials(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export default function EmployerTasksPage() {
  const [tab, setTab] = useState<Tab>("review");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [title, setTitle] = useState("MCQ: HTTP код 404");
  const [type, setType] = useState("mcq");
  const [prompt, setPrompt] = useState("Что означает 404?");
  const [options, setOptions] = useState("OK\nNot Found\nServer Error");
  const [correct, setCorrect] = useState(1);
  const [expected, setExpected] = useState("hello");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  async function load() {
    const [t, a] = await Promise.all([
      api<Task[]>("/api/employer/tasks"),
      api<Assignment[]>("/api/employer/tasks/assignments").catch(() => [] as Assignment[]),
    ]);
    setTasks(t);
    setAssignments(a);
    setSelectedId((prev) => {
      if (prev && a.some((x) => x.id === prev)) return prev;
      return a[0]?.id ?? null;
    });
  }

  useEffect(() => {
    void Promise.resolve().then(() =>
      load().catch((e) => {
        setError(formatApiError(e));
        setTasks([]);
      }),
    );
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      const body: Record<string, unknown> = {
        title,
        task_type: type,
        prompt,
      };
      if (type === "mcq") {
        body.options = options.split("\n").filter(Boolean);
        body.correct_index = correct;
      }
      if (type === "code") body.expected_stdout = expected;
      await api("/api/employer/tasks", { method: "POST", body });
      setOk("Задание создано — прикрепите его при приглашении кандидата");
      setTab("bank");
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  const filteredAssignments = useMemo(() => {
    if (reviewFilter === "submitted") {
      return assignments.filter((a) => a.status === "submitted");
    }
    if (reviewFilter === "pending") {
      return assignments.filter((a) => a.status === "pending");
    }
    if (reviewFilter === "graded") {
      return assignments.filter((a) => a.status === "graded");
    }
    return assignments;
  }, [assignments, reviewFilter]);

  const selected =
    filteredAssignments.find((a) => a.id === selectedId) ||
    filteredAssignments[0] ||
    null;

  const submittedCount = assignments.filter((a) => a.status === "submitted").length;

  return (
    <div className="grid gap-4">
      <div className="fsp-dossier-toolbar !mb-0">
        <div className="fsp-dossier-tabs" role="tablist" aria-label="Разделы заданий">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "review"}
            className={`fsp-dossier-tab${tab === "review" ? " active" : ""}`}
            onClick={() => setTab("review")}
          >
            просмотр ответов
            {submittedCount > 0 ? ` · ${submittedCount}` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "bank"}
            className={`fsp-dossier-tab${tab === "bank" ? " active" : ""}`}
            onClick={() => setTab("bank")}
          >
            банк заданий
          </button>
        </div>
      </div>

      {error && (
        <div className="fsp-soft-block !py-3">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
        </div>
      )}

      {tab === "review" ? (
        <>
          <section className="fsp-soft-block !py-4">
            <h1 className="fsp-soft-block-title !mb-1">Просмотр тестовых заданий</h1>
            <p className="muted text-sm">
              Ответы кандидатов по заданиям, прикреплённым к приглашениям
            </p>
            <div className="fsp-achievements-filters mt-3" role="tablist" aria-label="Фильтр ответов">
              {(
                [
                  ["all", "Все"],
                  ["submitted", "На проверке"],
                  ["pending", "Ожидают"],
                  ["graded", "Проверено"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`fsp-filter-pill${reviewFilter === id ? " active" : ""}`}
                  onClick={() => {
                    setReviewFilter(id);
                    setSelectedId(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {!filteredAssignments.length ? (
            <div className="fsp-soft-block empty-state">
              <p className="font-semibold">Пока нет ответов</p>
              <p className="muted max-w-md text-sm">
                Создайте задание в банке и прикрепите его при приглашении кандидата.
              </p>
              <button type="button" className="btn btn-primary mt-3" onClick={() => setTab("bank")}>
                Открыть банк заданий
              </button>
            </div>
          ) : (
            <div className="fsp-msg-shell">
              <aside className="fsp-msg-list" aria-label="Список ответов">
                <ul className="fsp-msg-threads">
                  {filteredAssignments.map((a) => {
                    const active = selected?.id === a.id;
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          className={`fsp-msg-thread${active ? " active" : ""}`}
                          onClick={() => setSelectedId(a.id)}
                        >
                          <div className="fsp-msg-avatar" aria-hidden>
                            {initials(a.candidate_name)}
                          </div>
                          <div className="fsp-msg-thread-body">
                            <div className="fsp-msg-thread-top">
                              <span className="fsp-msg-thread-name">
                                {a.candidate_name || "Кандидат"}
                              </span>
                              <span className={`badge ${taskStatusClass(a.status)}`}>
                                {labelTaskStatus(a.status)}
                              </span>
                            </div>
                            <p className="fsp-msg-thread-preview">{a.task_title}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>

              <section className="fsp-msg-window">
                {selected ? (
                  <div className="fsp-soft-block !h-full space-y-3 !rounded-[28px]">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge">{labelTaskType(selected.task_type)}</span>
                          <span className={`badge ${taskStatusClass(selected.status)}`}>
                            {labelTaskStatus(selected.status)}
                          </span>
                          {selected.score != null && (
                            <span className="badge badge-ok">{Math.round(selected.score)}%</span>
                          )}
                        </div>
                        <h2 className="mt-2 font-bold">{selected.task_title}</h2>
                        <p className="muted text-sm">
                          {selected.candidate_name || "Кандидат"}
                          {selected.submitted_at
                            ? ` · сдано ${formatDateTime(selected.submitted_at)}`
                            : ""}
                        </p>
                      </div>
                      {selected.invitation_id != null && (
                        <Link href="/employer/invitations" className="btn btn-ghost">
                          К сообщениям
                        </Link>
                      )}
                    </div>

                    <div className="rounded-2xl bg-white/70 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                        Условие
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                        {selected.prompt}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/70 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                        Ответ кандидата
                      </p>
                      {selected.code_submitted && (
                        <pre className="code-preview mt-2">{selected.code_submitted}</pre>
                      )}
                      {selected.answer_text && (
                        <p className="mt-2 whitespace-pre-wrap text-sm">{selected.answer_text}</p>
                      )}
                      {selected.answer_mcq_index != null && selected.options && (
                        <p className="mt-2 text-sm">
                          Выбран вариант:{" "}
                          <strong>
                            {selected.options[selected.answer_mcq_index] ??
                              selected.answer_mcq_index}
                          </strong>
                        </p>
                      )}
                      {!selected.code_submitted &&
                        !selected.answer_text &&
                        selected.answer_mcq_index == null && (
                          <p className="muted mt-2 text-sm">Ответ ещё не сдан</p>
                        )}
                    </div>

                    {selected.feedback && (
                      <p className="muted text-xs">Комментарий: {selected.feedback}</p>
                    )}
                  </div>
                ) : (
                  <div className="fsp-msg-empty">
                    <p className="muted text-sm">Выберите ответ слева</p>
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={onSubmit} className="fsp-soft-block space-y-3">
            <h2 className="fsp-soft-block-title">Новое задание</h2>
            <p className="muted -mt-2 text-sm">
              Кандидат увидит его в «Заданиях», если прикрепите к приглашению
            </p>
            <div className="field">
              <label>Название</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="field">
              <label>Тип</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="mcq">Тест (MCQ)</option>
                <option value="code">Код (автопроверка stdout)</option>
                <option value="open">Открытый ответ</option>
              </select>
            </div>
            <div className="field">
              <label>Условие</label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
              />
            </div>
            {type === "mcq" && (
              <>
                <div className="field">
                  <label>Варианты (по строке)</label>
                  <textarea rows={4} value={options} onChange={(e) => setOptions(e.target.value)} />
                </div>
                <div className="field">
                  <label>Номер правильного ответа (с нуля)</label>
                  <input
                    type="number"
                    min={0}
                    value={correct}
                    onChange={(e) => setCorrect(Number(e.target.value))}
                  />
                </div>
              </>
            )}
            {type === "code" && (
              <div className="field">
                <label>Ожидаемый stdout (точное совпадение)</label>
                <input value={expected} onChange={(e) => setExpected(e.target.value)} />
              </div>
            )}
            {ok && <p className="text-sm font-semibold text-[var(--ok)]">{ok}</p>}
            <button className="btn btn-primary">Создать задание</button>
          </form>

          <section className="space-y-3">
            <div className="fsp-soft-block !py-4">
              <h2 className="fsp-soft-block-title !mb-0">Банк заданий</h2>
            </div>
            {tasks === null && (
              <div className="fsp-soft-block empty-state">
                <p className="muted text-sm">Загрузка…</p>
              </div>
            )}
            {tasks && !tasks.length && (
              <div className="fsp-soft-block empty-state">
                <p className="muted text-sm">Пока нет заданий — создайте первое слева</p>
              </div>
            )}
            {tasks?.map((t) => (
              <article key={t.id} className="fsp-soft-block space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge">{labelTaskType(t.task_type)}</span>
                  <span className="muted text-xs">#{t.id}</span>
                </div>
                <p className="font-semibold">{t.title}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.prompt}</p>
                {t.options?.length ? (
                  <ul className="muted list-inside list-disc text-xs">
                    {t.options.map((o, i) => (
                      <li key={i}>
                        {i}. {o}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
