"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  resumed?: boolean;
  answers?: Record<number, number>;
}

interface Result {
  score: number;
  passed: boolean;
  confirmed_grade?: string;
  category_title?: string;
  proctor_flagged?: boolean;
  plagiarism_score?: number;
}

interface HistoryItem {
  id: number;
  category_title?: string | null;
  variant_group: string;
  score?: number | null;
  passed?: boolean | null;
  started_at: string;
  finished_at?: string | null;
}

/** Сколько вопросов показывать за раз — чтобы не было длинного скролла. */
const QUESTIONS_PER_BLOCK = 4;

const storageKey = (attemptId: number) => `fsp_test_answers_${attemptId}`;
const blockStorageKey = (attemptId: number) => `fsp_test_block_${attemptId}`;

function loadLocalAnswers(attemptId: number): Record<number, number> {
  try {
    const raw = localStorage.getItem(storageKey(attemptId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [Number(k), Number(v)]),
    );
  } catch {
    return {};
  }
}

function saveLocalAnswers(attemptId: number, answers: Record<number, number>) {
  try {
    localStorage.setItem(storageKey(attemptId), JSON.stringify(answers));
  } catch {
    /* ignore quota */
  }
}

function clearLocalAnswers(attemptId: number) {
  try {
    localStorage.removeItem(storageKey(attemptId));
    localStorage.removeItem(blockStorageKey(attemptId));
  } catch {
    /* ignore */
  }
}

function loadBlockIndex(attemptId: number, blockCount: number): number {
  try {
    const raw = localStorage.getItem(blockStorageKey(attemptId));
    if (raw == null) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.min(Math.max(0, Math.floor(n)), Math.max(0, blockCount - 1));
  } catch {
    return 0;
  }
}

function saveBlockIndex(attemptId: number, blockIndex: number) {
  try {
    localStorage.setItem(blockStorageKey(attemptId), String(blockIndex));
  } catch {
    /* ignore */
  }
}

function firstIncompleteBlock(
  questions: Question[],
  answers: Record<number, number>,
  perBlock: number,
): number {
  const blockCount = Math.max(1, Math.ceil(questions.length / perBlock));
  for (let b = 0; b < blockCount; b++) {
    const slice = questions.slice(b * perBlock, (b + 1) * perBlock);
    if (slice.some((q) => answers[q.id] === undefined)) return b;
  }
  return Math.max(0, blockCount - 1);
}

function mergeAnswers(
  ...parts: Array<Record<number, number> | undefined>
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const part of parts) {
    if (!part) continue;
    for (const [k, v] of Object.entries(part)) {
      out[Number(k)] = Number(v);
    }
  }
  return out;
}

export default function TestPage() {
  const [started, setStarted] = useState<StartResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasOpen, setHasOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [blockIndex, setBlockIndex] = useState(0);
  const answersRef = useRef(answers);
  const startedRef = useRef(started);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  function applyAttempt(data: StartResponse) {
    const local = loadLocalAnswers(data.attempt_id);
    const merged = mergeAnswers(data.answers, local);
    const blockCount = Math.max(1, Math.ceil(data.questions.length / QUESTIONS_PER_BLOCK));
    const savedBlock = loadBlockIndex(data.attempt_id, blockCount);
    const resumeBlock =
      data.resumed || Object.keys(merged).length > 0
        ? firstIncompleteBlock(data.questions, merged, QUESTIONS_PER_BLOCK)
        : savedBlock;
    setStarted(data);
    setAnswers(merged);
    setBlockIndex(resumeBlock);
    saveLocalAnswers(data.attempt_id, merged);
    saveBlockIndex(data.attempt_id, resumeBlock);
    setHasOpen(true);
  }

  function goToBlock(next: number) {
    if (!started) return;
    const blockCount = Math.max(1, Math.ceil(started.questions.length / QUESTIONS_PER_BLOCK));
    const clamped = Math.min(Math.max(0, next), blockCount - 1);
    setBlockIndex(clamped);
    saveBlockIndex(started.attempt_id, clamped);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function persistAnswers(
    attemptId: number,
    next: Record<number, number>,
    opts?: { keepalive?: boolean },
  ) {
    saveLocalAnswers(attemptId, next);
    const token = localStorage.getItem("token");
    try {
      await fetch(`${API_URL}/api/candidate/test/${attemptId}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ answers: next }),
        keepalive: Boolean(opts?.keepalive),
      });
    } catch {
      /* локальная копия уже есть */
    }
  }

  function schedulePersist(attemptId: number, next: Record<number, number>) {
    saveLocalAnswers(attemptId, next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistAnswers(attemptId, next);
    }, 400);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<StartResponse | null>("/api/candidate/test/current");
        if (cancelled) return;
        if (data?.attempt_id) {
          applyAttempt(data);
        } else {
          setHasOpen(false);
        }
      } catch {
        if (!cancelled) setHasOpen(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
      try {
        const items = await api<HistoryItem[]>("/api/candidate/test/history");
        if (!cancelled) setHistory(items.filter((h) => h.finished_at));
      } catch {
        if (!cancelled) setHistory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const token = localStorage.getItem("token");
    const sendProctor = (event: string) => {
      fetch(`${API_URL}/api/candidate/test/${started.attempt_id}/proctor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ event }),
      }).catch(() => {});
    };
    const flush = () => {
      const cur = startedRef.current;
      if (!cur) return;
      void persistAnswers(cur.attempt_id, answersRef.current, { keepalive: true });
    };
    const onBlur = () => {
      sendProctor("blur");
      flush();
    };
    const onPaste = () => sendProctor("paste");
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        sendProctor("visibility");
        flush();
      }
    };
    const onPageHide = () => flush();
    window.addEventListener("blur", onBlur);
    window.addEventListener("paste", onPaste);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVis);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flush();
    };
  }, [started?.attempt_id]);

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
      applyAttempt(data);
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
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await persistAnswers(started.attempt_id, answers);
      const data = await api<Result>("/api/candidate/test/submit", {
        method: "POST",
        body: { attempt_id: started.attempt_id, answers },
      });
      clearLocalAnswers(started.attempt_id);
      setHasOpen(false);
      setResult(data);
      try {
        const items = await api<HistoryItem[]>("/api/candidate/test/history");
        setHistory(items.filter((h) => h.finished_at));
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  function selectAnswer(questionId: number, optionIndex: number) {
    if (!started) return;
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: optionIndex };
      schedulePersist(started.attempt_id, next);
      return next;
    });
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
              setAnswers({});
              setBlockIndex(0);
            }}
          >
            Пройти ещё раз
          </button>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="panel max-w-xl">
        <p className="muted text-sm">Проверяем незавершённый тест…</p>
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
            Антислив: каждому выдаётся свой вариант (группа A или B целиком). Сначала пройдите опрос.
          </p>
        </div>
        <div className="panel max-w-xl space-y-4">
          <ul className="muted space-y-2 text-sm">
            <li>· Вопросы зависят от выбранной специализации и грейда</li>
            <li>· Тест идёт блоками по {QUESTIONS_PER_BLOCK} вопроса — без длинного списка сразу</li>
            <li>· Для прохождения нужно набрать не меньше 60%</li>
            <li>· Ответы сохраняются — можно вернуться после смены вкладки</li>
            <li>· После успеха категория появится в подборке работодателей</li>
          </ul>
          {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
          <button className="btn btn-primary" onClick={start} disabled={loading}>
            {loading ? "Старт…" : hasOpen ? "Продолжить тест" : "Начать тест"}
          </button>
        </div>

        {history.length > 0 && (
          <section className="panel max-w-xl space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
              История попыток
            </h3>
            <ul className="space-y-2">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold">{h.category_title || `Категория #${h.id}`}</p>
                    <p className="muted text-xs">
                      вариант {h.variant_group}
                      {h.finished_at
                        ? ` · ${new Date(h.finished_at).toLocaleString("ru-RU")}`
                        : ""}
                    </p>
                  </div>
                  <span className={`badge ${h.passed ? "ok" : ""}`}>
                    {h.score != null ? `${Math.round(h.score)}%` : "—"}
                    {h.passed == null ? "" : h.passed ? " · сдан" : " · не сдан"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const total = started.questions.length;
  const progress = total ? Math.round((answered / total) * 100) : 0;
  const blockCount = Math.max(1, Math.ceil(total / QUESTIONS_PER_BLOCK));
  const safeBlock = Math.min(blockIndex, blockCount - 1);
  const blockStart = safeBlock * QUESTIONS_PER_BLOCK;
  const blockQuestions = started.questions.slice(blockStart, blockStart + QUESTIONS_PER_BLOCK);
  const blockAnswered = blockQuestions.filter((q) => answers[q.id] !== undefined).length;
  const blockComplete = blockAnswered === blockQuestions.length;
  const isLastBlock = safeBlock >= blockCount - 1;

  return (
    <div className="space-y-4">
      <div className="panel sticky top-3 z-10 flex flex-wrap items-center justify-between gap-3 !py-3 backdrop-blur">
        <div>
          <h2 className="section-title text-lg">
            {started.category_title}
          </h2>
          <p className="muted text-sm">
            Вариант {started.variant_group} · блок {safeBlock + 1}/{blockCount} · отвечено{" "}
            {answered}/{total}
            {started.resumed ? " · продолжение" : ""}
          </p>
          {started.integrity_hint && (
            <p className="muted text-xs">{started.integrity_hint}</p>
          )}
        </div>
        {isLastBlock ? (
          <button className="btn btn-primary" onClick={submit} disabled={loading || answered < total}>
            {loading ? "Отправка…" : "Сдать тест"}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => goToBlock(safeBlock + 1)}
            disabled={!blockComplete}
          >
            Далее
          </button>
        )}
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
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: blockCount }, (_, b) => {
            const slice = started.questions.slice(
              b * QUESTIONS_PER_BLOCK,
              (b + 1) * QUESTIONS_PER_BLOCK,
            );
            const done = slice.every((q) => answers[q.id] !== undefined);
            const active = b === safeBlock;
            return (
              <button
                key={b}
                type="button"
                onClick={() => goToBlock(b)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? "border-[var(--brand)] bg-[#eef5fc] text-[var(--ink)]"
                    : done
                      ? "border-[var(--ok)] text-[var(--ok)]"
                      : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]"
                }`}
                aria-current={active ? "step" : undefined}
              >
                Блок {b + 1}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}

      <p className="muted text-sm">
        Вопросы {blockStart + 1}–{blockStart + blockQuestions.length} из {total}
      </p>

      {blockQuestions.map((q, idx) => (
        <div key={q.id} className="panel">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="badge">{q.topic}</span>
            <span className="muted text-xs">Вопрос {blockStart + idx + 1}</span>
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
                    onChange={() => selectAnswer(q.id, i)}
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="panel flex flex-wrap items-center justify-between gap-3 !py-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => goToBlock(safeBlock - 1)}
          disabled={safeBlock === 0}
        >
          Назад
        </button>
        <p className="muted text-xs">
          В блоке {blockAnswered}/{blockQuestions.length}
        </p>
        {isLastBlock ? (
          <button className="btn btn-primary" onClick={submit} disabled={loading || answered < total}>
            {loading ? "Отправка…" : "Сдать тест"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => goToBlock(safeBlock + 1)}
            disabled={!blockComplete}
          >
            Далее
          </button>
        )}
      </div>
    </div>
  );
}
