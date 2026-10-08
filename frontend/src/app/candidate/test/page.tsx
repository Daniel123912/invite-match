"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL, api, formatApiError } from "@/lib/api";

interface Question {
  id: number;
  topic: string;
  text: string;
  options: string[];
  difficulty: number;
}

interface StartResponse {
  attempt_id: number;
  variant_group: string;
  questions: Question[];
  category_title: string;
  integrity_hint?: string;
}

interface Result {
  score: number;
  passed: boolean;
  confirmed_grade?: string;
  category_title?: string;
  proctor_flagged?: boolean;
  plagiarism_score?: number;
}

export default function TestPage() {
  const [started, setStarted] = useState<StartResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!started) return;
    const token = localStorage.getItem("token");
    const send = (event: string) => {
      fetch(`${API_URL}/api/candidate/test/${started.attempt_id}/proctor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ event }),
      }).catch(() => {});
    };
    const onBlur = () => send("blur");
    const onPaste = () => send("paste");
    const onVis = () => {
      if (document.visibilityState === "hidden") send("visibility");
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("paste", onPaste);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("paste", onPaste);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [started]);

  const answered = useMemo(
    () => (started ? started.questions.filter((q) => answers[q.id] !== undefined).length : 0),
    [started, answers],
  );

  async function start() {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await api<StartResponse>("/api/candidate/test/start", { method: "POST" });
      setStarted(data);
      setAnswers({});
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!started) return;
    setLoading(true);
    setError("");
    try {
      const data = await api<Result>("/api/candidate/test/submit", {
        method: "POST",
        body: { attempt_id: started.attempt_id, answers },
      });
      setResult(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="grid gap-4">
        <div>
          <h2 className="section-title text-xl">
            Результат теста
          </h2>
        </div>
        <div className="panel max-w-xl">
          <p className="muted text-sm">Итоговый балл</p>
          <p className="font-display mt-2 text-5xl font-bold tracking-tight">
            {result.score}%
          </p>
          <div className="mt-4 rounded-xl border border-[var(--line)] px-4 py-3 text-sm">
            {result.passed ? (
              <p className="font-semibold text-[var(--ok)]">
                Категория присвоена: {result.category_title} ({result.confirmed_grade})
              </p>
            ) : (
              <p className="font-semibold text-[var(--warn)]">
                Не пройден порог 60%. Грейд не понижен принудительно — можно пересдать позже.
              </p>
            )}
            {result.proctor_flagged && (
              <p className="mt-2 text-xs text-[var(--danger)]">Прокторинг: подозрительная активность</p>
            )}
            {result.plagiarism_score != null && result.plagiarism_score >= 0.85 && (
              <p className="mt-2 text-xs text-[var(--danger)]">
                Антиплагиат: совпадение ответов {Math.round(result.plagiarism_score * 100)}%
              </p>
            )}
          </div>
          <button
            className="btn btn-ghost mt-5"
            onClick={() => {
              setResult(null);
              setStarted(null);
            }}
          >
            Пройти ещё раз
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="grid gap-4">
        <div>
          <h2 className="section-title text-xl">
            Тест на категорию
          </h2>
          <p className="muted mt-1 text-sm">
            Антислив: каждому выдаётся свой вариант (группа A/B). Сначала пройдите опрос.
          </p>
        </div>
        <div className="panel max-w-xl space-y-4">
          <ul className="muted space-y-2 text-sm">
            <li>· Вопросы зависят от выбранной специализации и грейда</li>
            <li>· Для прохождения нужно набрать не меньше 60%</li>
            <li>· После успеха категория появится в подборке работодателей</li>
          </ul>
          {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
          <button className="btn btn-primary" onClick={start} disabled={loading}>
            {loading ? "Старт…" : "Начать тест"}
          </button>
        </div>
      </div>
    );
  }

  const total = started.questions.length;
  const progress = total ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="panel sticky top-3 z-10 flex flex-wrap items-center justify-between gap-3 !py-3 backdrop-blur">
        <div>
          <h2 className="section-title text-lg">
            {started.category_title}
          </h2>
          <p className="muted text-sm">
            Вариант {started.variant_group} · отвечено {answered}/{total}
          </p>
          {started.integrity_hint && (
            <p className="muted text-xs">{started.integrity_hint}</p>
          )}
        </div>
        <button className="btn btn-primary" onClick={submit} disabled={loading || answered < total}>
          {loading ? "Отправка…" : "Сдать тест"}
        </button>
      </div>

      <div className="panel !py-3">
        <div className="mb-2 flex justify-between text-xs font-semibold text-[var(--muted)]">
          <span>Прогресс</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}

      {started.questions.map((q, idx) => (
        <div key={q.id} className="panel">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="badge">{q.topic}</span>
            <span className="muted text-xs">Вопрос {idx + 1}</span>
          </div>
          <p className="font-semibold leading-snug">{q.text}</p>
          <div className="mt-3 grid gap-2">
            {q.options.map((opt, i) => {
              const selected = answers[q.id] === i;
              return (
                <label
                  key={i}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                    selected
                      ? "border-[var(--brand)] bg-[#eef5fc]"
                      : "border-[var(--line)] hover:border-[var(--brand)]"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={selected}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
