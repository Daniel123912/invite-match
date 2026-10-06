"use client";

import { useState } from "react";
import { api } from "@/lib/api";

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
}

interface Result {
  score: number;
  passed: boolean;
  confirmed_grade?: string;
  category_title?: string;
}

export default function TestPage() {
  const [started, setStarted] = useState<StartResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function start() {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await api<StartResponse>("/api/candidate/test/start", { method: "POST" });
      setStarted(data);
      setAnswers({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
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
        body: JSON.stringify({ attempt_id: started.attempt_id, answers }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="panel max-w-lg">
        <h2 className="text-xl font-bold">Результат теста</h2>
        <p className="mt-3 text-3xl font-bold">{result.score}%</p>
        <p className="mt-2">
          {result.passed ? (
            <span className="text-[var(--ok)]">
              Категория присвоена: {result.category_title} ({result.confirmed_grade})
            </span>
          ) : (
            <span className="text-[var(--warn)]">
              Не пройден порог 60%. Грейд не понижен принудительно — можно пересдать позже.
            </span>
          )}
        </p>
        <button className="btn btn-ghost mt-4" onClick={() => { setResult(null); setStarted(null); }}>
          Ещё раз
        </button>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="panel max-w-lg space-y-4">
        <h2 className="text-xl font-bold">Тест на категорию</h2>
        <p className="muted text-sm">
          Антислив: каждому выдаётся свой вариант (группа A/B) из банка заданий. Сначала пройдите
          опрос.
        </p>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" onClick={start} disabled={loading}>
          {loading ? "Старт…" : "Начать тест"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{started.category_title}</h2>
          <p className="muted text-sm">Вариант {started.variant_group} · {started.questions.length} вопросов</p>
        </div>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          Сдать тест
        </button>
      </div>
      {error && <p className="text-[var(--danger)]">{error}</p>}
      {started.questions.map((q, idx) => (
        <div key={q.id} className="panel">
          <p className="badge mb-2">{q.topic}</p>
          <p className="font-semibold">
            {idx + 1}. {q.text}
          </p>
          <div className="mt-3 space-y-2">
            {q.options.map((opt, i) => (
              <label key={i} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={answers[q.id] === i}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
