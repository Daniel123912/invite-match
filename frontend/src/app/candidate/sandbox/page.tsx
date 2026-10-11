"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";

type Lang = "python" | "javascript" | "sql";

type Example = {
  id: string;
  title: string;
  hint: string;
  code: string;
  stdin?: string;
};

const LANGUAGES: {
  id: Lang;
  label: string;
  file: string;
  blurb: string;
  placeholder: string;
  stdinHint: string;
  showStdin: boolean;
}[] = [
  {
    id: "python",
    label: "Python",
    file: "main.py",
    blurb: "AST allowlist · без os / subprocess / open / eval",
    placeholder: "# ваш код здесь",
    stdinHint: "Входные данные для input()…",
    showStdin: true,
  },
  {
    id: "javascript",
    label: "JavaScript",
    file: "main.js",
    blurb: "vm-песочница Node · без require / process / eval",
    placeholder: "// ваш код здесь",
    stdinHint: "Строки для input()…",
    showStdin: true,
  },
  {
    id: "sql",
    label: "SQL",
    file: "query.sql",
    blurb: "SQLite in-memory · таблицы employees, departments",
    placeholder: "-- SELECT …",
    stdinHint: "",
    showStdin: false,
  },
];

const EXAMPLES: Record<Lang, Example[]> = {
  python: [
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
  ],
  javascript: [
    {
      id: "hello",
      title: "Hello",
      hint: "console.log",
      code: "console.log('FSP Match sandbox');\nconsole.log(2 + 2);",
    },
    {
      id: "stdin",
      title: "stdin",
      hint: "Функция input()",
      code: "const name = input().trim();\nconsole.log(`Привет, ${name}!`);",
      stdin: "Алекс",
    },
    {
      id: "fizz",
      title: "FizzBuzz",
      hint: "Цикл",
      code: `const n = 15;
for (let i = 1; i <= n; i++) {
  if (i % 15 === 0) console.log("FizzBuzz");
  else if (i % 3 === 0) console.log("Fizz");
  else if (i % 5 === 0) console.log("Buzz");
  else console.log(i);
}`,
    },
    {
      id: "map",
      title: "Массив",
      hint: "map / filter",
      code: `const nums = [5, 1, 9, 2, 7];
console.log(nums.slice().sort((a, b) => a - b));
console.log(nums.filter((x) => x > 4));`,
    },
  ],
  sql: [
    {
      id: "select",
      title: "SELECT",
      hint: "Все сотрудники",
      code: "SELECT id, name, dept, salary\nFROM employees\nORDER BY salary DESC;",
    },
    {
      id: "join",
      title: "JOIN",
      hint: "Отделы и бюджет",
      code: `SELECT e.name, e.dept, e.salary, d.budget
FROM employees e
JOIN departments d ON d.name = e.dept
WHERE e.salary > 100000
ORDER BY e.salary DESC;`,
    },
    {
      id: "agg",
      title: "GROUP BY",
      hint: "Средняя зарплата",
      code: `SELECT dept,
       COUNT(*) AS cnt,
       ROUND(AVG(salary), 0) AS avg_salary
FROM employees
GROUP BY dept
ORDER BY avg_salary DESC;`,
    },
    {
      id: "insert",
      title: "INSERT",
      hint: "Добавить и проверить",
      code: `INSERT INTO employees (id, name, dept, salary)
VALUES (6, 'Фёдор', 'Engineering', 170000);

SELECT * FROM employees WHERE dept = 'Engineering';`,
    },
  ],
};

export default function SandboxPage() {
  const [language, setLanguage] = useState<Lang>("python");
  const langMeta = useMemo(
    () => LANGUAGES.find((l) => l.id === language)!,
    [language],
  );
  const examples = EXAMPLES[language];

  const [code, setCode] = useState(EXAMPLES.python[0].code);
  const [stdin, setStdin] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [activeExample, setActiveExample] = useState("hello");

  function resetOutput() {
    setStdout("");
    setStderr("");
    setExitCode(null);
    setOk(null);
    setElapsed(null);
    setError("");
  }

  function switchLanguage(lang: Lang) {
    if (lang === language) return;
    setLanguage(lang);
    const first = EXAMPLES[lang][0];
    setActiveExample(first.id);
    setCode(first.code);
    setStdin(first.stdin || "");
    resetOutput();
  }

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
        body: { code, stdin, language },
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
  }, [code, stdin, language]);

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

  function loadExample(ex: Example) {
    setActiveExample(ex.id);
    setCode(ex.code);
    setStdin(ex.stdin || "");
    resetOutput();
  }

  return (
    <div className="sandbox-page grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title text-xl">Песочница</h2>
          <p className="muted mt-1 text-sm">
            Изолированный запуск до 3 с · {langMeta.blurb}
          </p>
        </div>
        <p className="muted text-xs">
          Горячая клавиша: <kbd className="sandbox-kbd">Ctrl</kbd> +{" "}
          <kbd className="sandbox-kbd">Enter</kbd>
        </p>
      </div>

      <div className="sandbox-langs" role="tablist" aria-label="Язык">
        {LANGUAGES.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={language === l.id}
            className={`sandbox-lang ${language === l.id ? "active" : ""}`}
            onClick={() => switchLanguage(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="sandbox-examples">
        {examples.map((ex) => (
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
            <span className="sandbox-file">{langMeta.file}</span>
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
            placeholder={langMeta.placeholder}
          />
        </div>

        <div className="sandbox-side">
          {langMeta.showStdin && (
            <div className="sandbox-pane">
              <div className="sandbox-toolbar">
                <span className="font-semibold text-xs tracking-wide">stdin</span>
              </div>
              <textarea
                className="sandbox-stdin"
                rows={3}
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder={langMeta.stdinHint}
                spellCheck={false}
              />
            </div>
          )}

          {language === "sql" && (
            <div className="sandbox-pane">
              <div className="sandbox-toolbar">
                <span className="font-semibold text-xs tracking-wide">Схема БД</span>
              </div>
              <pre className="sandbox-schema muted">
                {`employees(id, name, dept, salary)
departments(id, name, budget)`}
              </pre>
            </div>
          )}

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
