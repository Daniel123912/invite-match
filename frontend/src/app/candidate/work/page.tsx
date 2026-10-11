"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import {
  formatDateTime,
  labelGrade,
  labelSpec,
  labelTaskStatus,
  labelTaskType,
} from "@/lib/labels";

interface Profile {
  full_name: string;
  specialization?: string;
  selected_grade?: string;
  confirmed_grade?: string;
  test_score?: number;
  fsp_score: number;
  has_fsp_history: boolean;
}

interface CategoryInfo {
  category_title?: string | null;
  confirmed_grade?: string | null;
  test_score?: number | null;
  cooldown_days?: number;
  last_grade_change_at?: string | null;
}

interface Task {
  id: number;
  task_title: string;
  task_type: string;
  prompt: string;
  status: string;
  score?: number | null;
  company_name?: string | null;
  submitted_at?: string | null;
}

interface OpenAttempt {
  attempt_id: number;
  category_title?: string;
  questions?: unknown[];
}

type Filter = "all" | "tests" | "tasks";

type WorkItem = {
  id: string;
  kind: "test" | "task" | "sandbox";
  title: string;
  detail: string;
  meta: string;
  href: string;
  cta: string;
  icon: "test" | "task" | "code";
  badge?: string;
};

function WorkIcon({ kind }: { kind: WorkItem["icon"] }) {
  if (kind === "code") {
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="m8 8-4 4 4 4M16 8l4 4-4 4M13 6l-2 12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "task") {
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="4" width="14" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 9h6M9 13h6M9 17h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 10h4M10 14h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function CandidateWorkPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [openAttempt, setOpenAttempt] = useState<OpenAttempt | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    Promise.all([
      api<Profile>("/api/candidate/profile"),
      api<CategoryInfo>("/api/candidate/category").catch(() => null),
      api<Task[]>("/api/candidate/tasks").catch(() => []),
      api<OpenAttempt | null>("/api/candidate/test/current").catch(() => null),
    ])
      .then(([p, cat, taskRows, current]) => {
        setProfile(p);
        setCategory(cat);
        setTasks(taskRows || []);
        setOpenAttempt(current?.attempt_id ? current : null);
      })
      .catch((e) => setError(formatApiError(e)));
  }, []);

  const items = useMemo<WorkItem[]>(() => {
    if (!profile) return [];

    const testTitle = openAttempt
      ? `Продолжить тест · ${openAttempt.category_title || "категория"}`
      : profile.confirmed_grade
        ? "Повторный тест категории"
        : "Тест на категорию";

    const testDetail = openAttempt
      ? "Есть незавершённая попытка — можно продолжить с сохранённых ответов"
      : profile.confirmed_grade
        ? `Текущая категория: ${labelSpec(profile.specialization)} × ${labelGrade(profile.confirmed_grade)}`
        : profile.specialization
          ? `После опроса: ${labelSpec(profile.specialization)} · ${labelGrade(profile.selected_grade)}`
          : "Сначала пройдите опрос, затем подтвердите уровень тестом";

    let testMeta = "без срока";
    if (openAttempt) {
      testMeta = "попытка открыта";
    } else if (category?.last_grade_change_at && category.cooldown_days) {
      testMeta = `кулдаун ${category.cooldown_days} дн. · смена ${formatDateTime(category.last_grade_change_at)}`;
    } else if (category?.cooldown_days) {
      testMeta = `кулдаун смены грейда: ${category.cooldown_days} дн.`;
    }

    const list: WorkItem[] = [
      {
        id: "category-test",
        kind: "test",
        title: testTitle,
        detail: testDetail,
        meta: `осталось времени: ${testMeta}`,
        href: "/candidate/test",
        cta: openAttempt ? "продолжить" : "начать",
        icon: "test",
        badge: profile.test_score != null ? `${profile.test_score}%` : undefined,
      },
      {
        id: "sandbox",
        kind: "sandbox",
        title: "Песочница",
        detail: "Тренировка кода на Python, JavaScript и SQL без влияния на категорию",
        meta: "осталось времени: без срока",
        href: "/candidate/sandbox",
        cta: "начать",
        icon: "code",
      },
      ...tasks.map((t) => {
        const type = String(t.task_type || "").toLowerCase();
        const preview = (t.prompt || "").replace(/\s+/g, " ").trim();
        return {
          id: `task-${t.id}`,
          kind: "task" as const,
          title: t.task_title || "Задание",
          detail:
            preview.slice(0, 140) + (preview.length > 140 ? "…" : "") ||
            `Задание от ${t.company_name || "работодателя"} · ${labelTaskType(type)}`,
          meta: t.submitted_at
            ? `сдано: ${formatDateTime(t.submitted_at)}`
            : `осталось времени: без срока · ${labelTaskStatus(t.status)}`,
          href: `/candidate/tasks#task-${t.id}`,
          cta: t.status === "pending" ? "начать" : "открыть",
          icon: "task" as const,
          badge: t.score != null ? `${Math.round(t.score)}%` : labelTaskType(type),
        };
      }),
    ];

    return list;
  }, [profile, category, tasks, openAttempt]);

  const visible = items.filter((item) => {
    if (filter === "tests") return item.kind === "test" || item.kind === "sandbox";
    if (filter === "tasks") return item.kind === "task";
    return true;
  });

  if (error && !profile) {
    return (
      <div className="fsp-soft-block empty-state">
        <p className="font-semibold text-[var(--danger)]">Не удалось загрузить</p>
        <p className="muted text-sm">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fsp-soft-block empty-state">
        <p className="muted">Загрузка тестов и заданий…</p>
      </div>
    );
  }

  const levelLine = [
    profile.confirmed_grade
      ? `${labelSpec(profile.specialization)} × ${labelGrade(profile.confirmed_grade)}`
      : profile.specialization
        ? `Цель: ${labelSpec(profile.specialization)} · ${labelGrade(profile.selected_grade)}`
        : "Уровень ещё не выбран",
    profile.test_score != null ? `тест ${profile.test_score}%` : null,
    profile.has_fsp_history ? `ФСП ${profile.fsp_score}` : null,
    openAttempt ? "есть открытая попытка" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="fsp-work">
      <section className="fsp-work-banner">
        <p className="fsp-work-banner-label">текущий уровень</p>
        <p className="fsp-work-banner-text">{levelLine}</p>
        {category?.category_title && (
          <p className="muted mt-2 text-sm">Категория: {category.category_title}</p>
        )}
      </section>

      <div className="fsp-work-head">
        <h1 className="fsp-work-title">
          {items.length}{" "}
          {items.length === 1 ? "задание и тест" : "заданий и тестов"}
        </h1>
        <div className="fsp-achievements-filters" role="tablist" aria-label="Фильтр">
          <button
            type="button"
            className={`fsp-filter-pill${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Все
          </button>
          <button
            type="button"
            className={`fsp-filter-pill${filter === "tests" ? " active" : ""}`}
            onClick={() => setFilter("tests")}
          >
            Тесты
          </button>
          <button
            type="button"
            className={`fsp-filter-pill${filter === "tasks" ? " active" : ""}`}
            onClick={() => setFilter("tasks")}
          >
            Задания
          </button>
        </div>
      </div>

      {error && (
        <div className="fsp-soft-block !py-3">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
        </div>
      )}

      <ul className="fsp-work-list">
        {visible.map((item, index) => (
          <li
            key={item.id}
            className="fsp-work-card"
            style={{ animationDelay: `${Math.min(index, 6) * 0.05}s` }}
          >
            <div className="fsp-work-card-icon">
              <WorkIcon kind={item.icon} />
            </div>
            <div className="fsp-work-card-body">
              <div className="fsp-work-card-top">
                <h2 className="fsp-work-card-title">{item.title}</h2>
                {item.badge && <span className="badge">{item.badge}</span>}
              </div>
              <p className="fsp-work-card-detail">{item.detail}</p>
              <p className="fsp-work-card-meta">{item.meta}</p>
            </div>
            <Link href={item.href} className="btn btn-primary fsp-work-cta">
              {item.cta}
            </Link>
          </li>
        ))}

        {visible.length === 0 && (
          <li className="fsp-work-card empty">
            <p className="muted text-sm">В этом фильтре пока пусто</p>
          </li>
        )}
      </ul>
    </div>
  );
}
