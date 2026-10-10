"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import {
  formatDateTime,
  labelTaskStatus,
  labelTaskType,
  taskStatusClass,
} from "@/lib/labels";

interface Task {
  id: number;
  task_title: string;
  task_type: string;
  prompt: string;
  options?: string[];
  status: string;
  score?: number | null;
  feedback?: string | null;
  company_name?: string | null;
  invitation_id?: number | null;
  submitted_at?: string | null;
  answer_text?: string | null;
  answer_mcq_index?: number | null;
  code_submitted?: string | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, { code?: string; mcq?: number; text?: string }>>(
    {},
  );
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  async function load() {
    setTasks(await api<Task[]>("/api/candidate/tasks"));
  }

  useEffect(() => {
    load().catch((e) => {
      setError(formatApiError(e));
      setTasks([]);
    });
  }, []);

  function patchAnswer(id: number, patch: { code?: string; mcq?: number; text?: string }) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function submit(id: number, type: string) {
    setBusy(id);
    setError("");
    const a = answers[id] || {};
    try {
      const body =
        type === "code"
          ? { code: a.code || "print('hello')" }
          : type === "mcq"
            ? { answer_mcq_index: a.mcq ?? 0 }
            : { answer_text: a.text || "" };
      await api(`/api/candidate/tasks/${id}/submit`, { method: "POST", body });
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(null);
    }
  }

  if (tasks === null) {
    return (
      <div className="panel empty-state">
        <p className="muted">Загрузка заданий…</p>
      </div>
    );
  }

  const pending = tasks.filter((t) => t.status === "pending").length;
  const visible = tasks.filter((t) => {
    if (filter === "pending") return t.status === "pending";
    if (filter === "done") return t.status !== "pending";
    return true;
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title text-xl">Задания от работодателя</h2>
          <p className="muted mt-1 text-sm">
            Появляются, когда работодатель прикрепляет задание к приглашению
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `Все · ${tasks.length}`],
              ["pending", `Ждут ответа · ${pending}`],
              ["done", "Сданные"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-ghost !py-2 !text-xs ${filter === key ? "!border-[var(--brand)] !text-[var(--brand-dark)]" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="panel !py-3">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
        </div>
      )}

      {!tasks.length ? (
        <div className="panel empty-state">
          <p className="font-semibold">Пока нет назначенных заданий</p>
          <p className="muted max-w-md text-sm">
            Работодатель может прикрепить тест, код или открытый вопрос при отправке приглашения.
          </p>
          <Link href="/candidate/invitations" className="btn btn-primary mt-2">
            К приглашениям
          </Link>
        </div>
      ) : !visible.length ? (
        <div className="panel empty-state">
          <p className="muted text-sm">Нет заданий в этом фильтре</p>
        </div>
      ) : (
        visible.map((t) => {
          const a = answers[t.id] || {};
          const type = String(t.task_type || "").toLowerCase();
          return (
            <article key={t.id} className="task-card panel space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge">{labelTaskType(type)}</span>
                    <span className={`badge ${taskStatusClass(t.status)}`}>
                      {labelTaskStatus(t.status)}
                    </span>
                    {t.score != null && (
                      <span className="badge badge-ok">{Math.round(t.score)}%</span>
                    )}
                  </div>
                  <h3 className="mt-2 text-lg font-bold tracking-tight">{t.task_title}</h3>
                  <p className="muted mt-1 text-sm">
                    от {t.company_name || "работодателя"}
                    {t.submitted_at ? ` · сдано ${formatDateTime(t.submitted_at)}` : ""}
                  </p>
                </div>
                {t.invitation_id != null && (
                  <Link href="/candidate/invitations" className="link-quiet text-sm">
                    К приглашению →
                  </Link>
                )}
              </div>

              <div className="task-prompt">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Условие
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{t.prompt}</p>
              </div>

              {t.status === "pending" && type === "code" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Решение на Python</p>
                    <Link href="/candidate/sandbox" className="link-quiet text-xs">
                      Открыть песочницу →
                    </Link>
                  </div>
                  <textarea
                    className="code-editor"
                    rows={8}
                    value={a.code ?? "print('hello')"}
                    onChange={(e) => patchAnswer(t.id, { code: e.target.value })}
                    spellCheck={false}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={busy === t.id}
                    onClick={() => submit(t.id, "code")}
                  >
                    {busy === t.id ? "Проверка…" : "Сдать код"}
                  </button>
                </div>
              )}

              {t.status === "pending" && type === "mcq" && t.options && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Выберите ответ</p>
                  {t.options.map((o, i) => (
                    <label key={i} className={`mcq-option ${(a.mcq ?? 0) === i ? "selected" : ""}`}>
                      <input
                        type="radio"
                        checked={(a.mcq ?? 0) === i}
                        onChange={() => patchAnswer(t.id, { mcq: i })}
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                  <button
                    className="btn btn-primary mt-2"
                    disabled={busy === t.id}
                    onClick={() => submit(t.id, "mcq")}
                  >
                    {busy === t.id ? "Отправка…" : "Ответить"}
                  </button>
                </div>
              )}

              {t.status === "pending" && type === "open" && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Ваш ответ</p>
                  <textarea
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    rows={5}
                    value={a.text ?? ""}
                    onChange={(e) => patchAnswer(t.id, { text: e.target.value })}
                    placeholder="Развёрнутый ответ…"
                  />
                  <button
                    className="btn btn-primary"
                    disabled={busy === t.id || !(a.text || "").trim()}
                    onClick={() => submit(t.id, "open")}
                  >
                    {busy === t.id ? "Отправка…" : "Отправить"}
                  </button>
                </div>
              )}

              {t.status !== "pending" && (
                <div className="task-result">
                  {type === "code" && t.code_submitted && (
                    <pre className="code-preview">{t.code_submitted}</pre>
                  )}
                  {type === "mcq" && t.answer_mcq_index != null && t.options && (
                    <p className="text-sm">
                      Ваш выбор:{" "}
                      <strong>{t.options[t.answer_mcq_index] ?? `#${t.answer_mcq_index}`}</strong>
                    </p>
                  )}
                  {type === "open" && t.answer_text && (
                    <p className="whitespace-pre-wrap text-sm">{t.answer_text}</p>
                  )}
                  {t.feedback && (
                    <p className="muted mt-2 text-xs leading-relaxed">Обратная связь: {t.feedback}</p>
                  )}
                </div>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}
