"use client";

import { FormEvent, useEffect, useState } from "react";
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
  submitted_at?: string | null;
  answer_text?: string | null;
  answer_mcq_index?: number | null;
  code_submitted?: string | null;
  options?: string[] | null;
}

export default function EmployerTasksPage() {
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

  async function load() {
    const [t, a] = await Promise.all([
      api<Task[]>("/api/employer/tasks"),
      api<Assignment[]>("/api/employer/tasks/assignments").catch(() => [] as Assignment[]),
    ]);
    setTasks(t);
    setAssignments(a);
  }

  useEffect(() => {
    load().catch((e) => {
      setError(formatApiError(e));
      setTasks([]);
    });
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
      setOk("Задание создано — прикрепите его в подборке при приглашении");
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="panel space-y-3">
          <h2 className="section-title text-xl">Новое задание</h2>
          <p className="muted text-sm">
            Кандидат увидит его в разделе «Задания», если прикрепите к приглашению
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
            <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
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
          {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
          {ok && <p className="text-sm font-semibold text-[var(--ok)]">{ok}</p>}
          <button className="btn btn-primary">Создать задание</button>
        </form>

        <div className="space-y-3">
          <h2 className="section-title text-xl">Банк заданий</h2>
          {tasks === null && <p className="muted text-sm">Загрузка…</p>}
          {tasks && !tasks.length && (
            <div className="panel empty-state">
              <p className="muted text-sm">Пока нет заданий — создайте первое слева</p>
            </div>
          )}
          {tasks?.map((t) => (
            <div key={t.id} className="panel space-y-2">
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
            </div>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="section-title text-xl">Ответы кандидатов</h2>
          <p className="muted mt-1 text-sm">Сданные задания по вашим приглашениям</p>
        </div>
        {!assignments.length ? (
          <div className="panel empty-state">
            <p className="muted text-sm">Пока нет назначений — прикрепите задание в подборке</p>
          </div>
        ) : (
          assignments.map((a) => (
            <article key={a.id} className="panel space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge">{labelTaskType(a.task_type)}</span>
                <span className={`badge ${taskStatusClass(a.status)}`}>
                  {labelTaskStatus(a.status)}
                </span>
                {a.score != null && (
                  <span className="badge badge-ok">{Math.round(a.score)}%</span>
                )}
              </div>
              <p className="font-semibold">
                {a.task_title}
                {a.candidate_name ? ` · ${a.candidate_name}` : ""}
              </p>
              {a.submitted_at && (
                <p className="muted text-xs">Сдано {formatDateTime(a.submitted_at)}</p>
              )}
              {a.code_submitted && <pre className="code-preview">{a.code_submitted}</pre>}
              {a.answer_text && (
                <p className="whitespace-pre-wrap text-sm">{a.answer_text}</p>
              )}
              {a.answer_mcq_index != null && a.options && (
                <p className="text-sm">
                  Ответ: <strong>{a.options[a.answer_mcq_index] ?? a.answer_mcq_index}</strong>
                </p>
              )}
              {a.feedback && <p className="muted text-xs">{a.feedback}</p>}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
