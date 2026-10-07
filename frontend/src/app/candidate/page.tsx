"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Profile {
  full_name: string;
  specialization?: string;
  selected_grade?: string;
  confirmed_grade?: string;
  category_id?: number;
  test_score?: number;
  fsp_id?: string;
  has_fsp_history: boolean;
  fsp_score: number;
  consent_152fz?: boolean;
}

const SPEC_LABELS: Record<string, string> = {
  backend: "Backend",
  frontend: "Frontend",
  fullstack: "Fullstack",
  devops: "DevOps",
  data: "Data",
  qa: "QA",
  mobile: "Mobile",
};

const GRADE_LABELS: Record<string, string> = {
  junior: "Junior",
  middle: "Middle",
  senior: "Senior",
};

function labelSpec(v?: string) {
  return v ? SPEC_LABELS[v] || v : "—";
}

function labelGrade(v?: string) {
  return v ? GRADE_LABELS[v] || v : "—";
}

export default function CandidateHome() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Profile>("/api/candidate/profile")
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="panel empty-state">
        <p className="text-[var(--danger)] font-semibold">Не удалось загрузить профиль</p>
        <p className="muted text-sm">{error}</p>
        <button className="btn btn-ghost mt-2" onClick={() => window.location.reload()}>
          Обновить
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="panel empty-state">
        <p className="muted">Загрузка кабинета…</p>
      </div>
    );
  }

  const profileOk = Boolean(profile.full_name?.trim());
  const surveyOk = Boolean(profile.specialization && profile.selected_grade);
  const testOk = Boolean(profile.confirmed_grade);
  const category =
    testOk && profile.specialization
      ? `${labelSpec(profile.specialization)} × ${labelGrade(profile.confirmed_grade)}`
      : null;

  const steps = [
    {
      ok: profileOk,
      current: !profileOk,
      label: "Профиль",
      hint: profileOk ? "Данные заполнены" : "Укажите ФИО и контакты",
      href: "/candidate/profile",
    },
    {
      ok: surveyOk,
      current: profileOk && !surveyOk,
      label: "Опрос",
      hint: surveyOk
        ? `${labelSpec(profile.specialization)} · ${labelGrade(profile.selected_grade)}`
        : "Выберите специализацию и грейд",
      href: "/candidate/survey",
    },
    {
      ok: testOk,
      current: surveyOk && !testOk,
      label: "Тест",
      hint: testOk
        ? `Сдано · ${profile.test_score ?? "—"}%`
        : surveyOk
          ? "Подтвердите категорию тестом"
          : "Сначала пройдите опрос",
      href: "/candidate/test",
    },
    {
      ok: testOk,
      current: testOk,
      label: "Приглашения",
      hint: testOk ? "Смотрите входящие офферы" : "Откроются после категории",
      href: "/candidate/invitations",
    },
  ];

  const doneCount = [profileOk, surveyOk, testOk].filter(Boolean).length;

  return (
    <div className="grid gap-4">
      <section className="panel overflow-hidden !p-0">
        <div className="relative px-5 py-6 md:px-7 md:py-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "linear-gradient(120deg, color-mix(in srgb, var(--brand) 14%, white) 0%, transparent 55%), linear-gradient(220deg, color-mix(in srgb, var(--accent) 10%, white) 0%, transparent 45%)",
            }}
          />
          <div className="relative">
            <p className="badge w-fit">Прогресс {doneCount}/3</p>
            <h2
              className="mt-3 text-2xl font-bold tracking-tight md:text-3xl"
              style={{ fontFamily: "var(--font-sora)" }}
            >
              {profile.full_name?.trim() || "Добро пожаловать"}
            </h2>
            <p className="muted mt-2 max-w-2xl text-sm leading-relaxed">
              Категория присваивается только после опроса и теста — не по самоописанию резюме.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {category ? (
                <span className="badge">Категория: {category}</span>
              ) : (
                <span className="badge">Категория ещё не присвоена</span>
              )}
              {profile.test_score != null && (
                <span className="badge">Тест: {profile.test_score}%</span>
              )}
              {profile.has_fsp_history ? (
                <span className="badge">ФСП: {profile.fsp_score} баллов</span>
              ) : (
                <span className="badge">Истории ФСП нет</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="stat-grid">
        <div className="panel">
          <p className="muted text-xs font-semibold uppercase tracking-wide">Специализация</p>
          <p className="mt-2 text-lg font-bold">{labelSpec(profile.specialization)}</p>
        </div>
        <div className="panel">
          <p className="muted text-xs font-semibold uppercase tracking-wide">Целевой грейд</p>
          <p className="mt-2 text-lg font-bold">{labelGrade(profile.selected_grade)}</p>
        </div>
        <div className="panel">
          <p className="muted text-xs font-semibold uppercase tracking-wide">Подтверждённый</p>
          <p className="mt-2 text-lg font-bold">{labelGrade(profile.confirmed_grade)}</p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-sora)" }}>
            Следующие шаги
          </h3>
          <p className="muted text-xs">Нажмите карточку, чтобы перейти</p>
        </div>
        <div className="step-rail">
          {steps.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className={`panel step-card ${s.ok ? "done" : ""} ${s.current ? "current" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="muted text-xs font-bold">Шаг {i + 1}</span>
                <span className={`status-dot ${s.ok ? "ok" : s.current ? "brand" : ""}`} />
              </div>
              <p className="text-base font-bold">{s.label}</p>
              <p className="muted text-sm leading-snug">{s.hint}</p>
              <span className="mt-auto text-sm font-semibold text-[var(--brand)]">
                {s.ok ? "Открыть" : s.current ? "Продолжить →" : "Позже"}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
