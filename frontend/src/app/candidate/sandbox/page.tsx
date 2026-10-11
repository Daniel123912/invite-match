"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";

const EXAMPLES: { id: string; title: string; hint: string; code: string; stdin?: string }[] = [
  {
    id: "hello",
    title: "Hello",
    hint: "Базовый вывод",
    code: "print('FSP Match sandbox')\nprint(2 + 2)",
  },
  {
    id: "stdin",
    title: "stdin",
    hint: "Чтение ввода",
    code: "name = input().strip()\nprint(f'Привет, {name}!')",
    stdin: "Алекс",
  },
  {
    id: "fizz",
    title: "FizzBuzz",
    hint: "Цикл и условия",
    code: `n = 15
for i in range(1, n + 1):
    if i % 15 == 0:
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)`,
  },
  {
    id: "sort",
    title: "Сортировка",
    hint: "Списки",
    code: `nums = [5, 1, 9, 2, 7]
print(sorted(nums))
print(sum(nums), max(nums))`,
  },
];

export default function SandboxPage() {
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [stdin, setStdin] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [activeExample, setActiveExample] = useState("hello");

  const run = useCallback(async () => {
    setRunning(true);
    setError("");
    setStdout("");
    setStderr("");
    setExitCode(null);
    setOk(null);
    const started = performance.now();
    try {
      const r = await api<{
        ok: boolean;
        stdout: string;
        stderr: string;
        exit_code: number;
      }>("/api/candidate/sandbox/run", {
        method: "POST",
        body: { code, stdin },
      });
      setStdout(r.stdout || "");
      setStderr(r.stderr || "");
      setExitCode(r.exit_code);
      setOk(r.ok);
      setElapsed(Math.round(performance.now() - started));
    } catch (e) {
      setError(formatApiError(e, "Не удалось запустить код"));
    } finally {
      setRunning(false);
    }
  }, [code, stdin]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  function loadExample(ex: (typeof EXAMPLES)[number]) {
    setActiveExample(ex.id);
    setCode(ex.code);
    setStdin(ex.stdin || "");
    setStdout("");
    setStderr("");
    setExitCode(null);
    setOk(null);
    setElapsed(null);
    setError("");
  }

  return (
    <div className="sandbox-page grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title text-xl">Песочница Python</h2>
          <p className="muted mt-1 text-sm">
            Изолированный запуск до 3 с · без os / subprocess / open / eval
          </p>
        </div>
        <p className="muted text-xs">
          Горячая клавиша: <kbd className="sandbox-kbd">Ctrl</kbd> +{" "}
          <kbd className="sandbox-kbd">Enter</kbd>
        </p>
      </div>

      <div className="sandbox-examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            type="button"
            className={`sandbox-chip ${activeExample === ex.id ? "active" : ""}`}
            onClick={() => loadExample(ex)}
          >
            <span>{ex.title}</span>
            <span className="muted text-[11px]">{ex.hint}</span>
          </button>
        ))}
      </div>

      <div className="sandbox-ide">
        <div className="sandbox-pane">
          <div className="sandbox-toolbar">
            <span className="sandbox-dot red" />
            <span className="sandbox-dot yellow" />
            <span className="sandbox-dot green" />
            <span className="sandbox-file">main.py</span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                className="btn btn-ghost !py-1.5 !text-xs"
                onClick={() => {
                  setCode("");
                  setStdout("");
                  setStderr("");
                }}
              >
                Очистить
              </button>
              <button
                type="button"
                className="btn btn-primary !py-1.5 !text-xs"
                disabled={running || !code.trim()}
                onClick={() => void run()}
              >
                {running ? "Запуск…" : "▶ Запустить"}
              </button>
            </div>
          </div>
          <textarea
            className="sandbox-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            placeholder="# ваш код здесь"
          />
        </div>

        <div className="sandbox-side">
          <div className="sandbox-pane">
            <div className="sandbox-toolbar">
              <span className="font-semibold text-xs tracking-wide">stdin</span>
            </div>
            <textarea
              className="sandbox-stdin"
              rows={3}
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Входные данные для input()…"
              spellCheck={false}
            />
          </div>

          <div className="sandbox-pane sandbox-console grow">
            <div className="sandbox-toolbar">
              <span className="font-semibold text-xs tracking-wide">Консоль</span>
              {exitCode != null && (
                <span className={`badge ml-auto !text-[11px] ${ok ? "badge-ok" : ""}`}>
                  exit {exitCode}
                  {elapsed != null ? ` · ${elapsed} ms` : ""}
                </span>
              )}
            </div>
            <div className="sandbox-output">
              {error && <p className="text-[var(--danger)]">{error}</p>}
              {!error && exitCode == null && !running && (
                <p className="muted">Результат появится здесь после запуска</p>
              )}
              {running && <p className="sandbox-running">Выполняется…</p>}
              {stdout && (
                <pre className="sandbox-stdout">
                  <span className="sandbox-stream-label">stdout</span>
                  {stdout}
                </pre>
              )}
              {stderr && (
                <pre className="sandbox-stderr">
                  <span className="sandbox-stream-label">stderr</span>
                  {stderr}
                </pre>
              )}
              {!running && exitCode != null && !stdout && !stderr && !error && (
                <p className="muted">Пустой вывод</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="muted text-xs leading-relaxed">
        Песочница подходит для тренировки и проверки решений перед сдачей кодовых заданий
        работодателя.
      </p>
    </div>
  );
}
