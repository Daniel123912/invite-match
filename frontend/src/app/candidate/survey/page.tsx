"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api, formatApiError } from "@/lib/api";
import { GRADES, INDUSTRIES, SPECIALIZATIONS, labelGrade, labelIndustry, labelSpec } from "@/lib/labels";

interface Profile {
  specialization?: string;
  selected_grade?: string;
  industry?: string;
  specializations?: string[];
  confirmed_grade?: string;
}

export default function SurveyPage() {
  const router = useRouter();
  const [industry, setIndustry] = useState("it");
  const [specialization, setSpecialization] = useState("backend");
  const [extraSpecs, setExtraSpecs] = useState<string[]>([]);
  const [grade, setGrade] = useState("junior");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasCategory, setHasCategory] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    api<Profile>("/api/candidate/profile")
      .then((p) => {
        if (p.industry) setIndustry(p.industry);
        if (p.specialization) setSpecialization(p.specialization);
        if (p.selected_grade) setGrade(p.selected_grade);
        if (p.specializations?.length) {
          setExtraSpecs(p.specializations.filter((s) => s !== p.specialization));
        }
        setHasCategory(Boolean(p.confirmed_grade));
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/candidate/survey", {
        method: "POST",
        body: {
          industry,
          specialization,
          selected_grade: grade,
          specializations: [specialization, ...extraSpecs.filter((s) => s !== specialization)],
        },
      });
      setOk(true);
      startTransition(() => {
        router.push("/candidate/test");
      });
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  if (!loaded) {
    return (
      <div className="panel empty-state">
        <p className="muted">Загрузка опроса…</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="section-title text-xl">Опрос перед тестом</h2>
        <p className="muted mt-1 text-sm">
          Грейд выбираете сами — тест подтвердит или нет. Категория = специализация × грейд.
        </p>
      </div>

      {hasCategory && (
        <div className="panel !py-3">
          <p className="text-sm">
            У вас уже есть подтверждённый грейд. Смена грейда возможна не чаще раза в 90 дней.
            Пересдача того же грейда — без ограничения.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="panel mx-auto w-full max-w-xl space-y-4">
        <div className="field">
          <label>Отрасль</label>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
            {INDUSTRIES.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Основная специализация (для теста)</label>
          <select value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
            {SPECIALIZATIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Доп. специализации в подборке</label>
          <div className="flex flex-wrap gap-2 text-sm">
            {SPECIALIZATIONS.map((s) => (
              <label key={s.value} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={extraSpecs.includes(s.value)}
                  disabled={s.value === specialization}
                  onChange={(e) =>
                    setExtraSpecs((prev) =>
                      e.target.checked ? [...prev, s.value] : prev.filter((x) => x !== s.value),
                    )
                  }
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Целевой грейд</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            {GRADES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm">
          <p className="font-semibold">Выбрано</p>
          <p className="muted mt-1">
            {labelSpec(specialization)} × {labelGrade(grade)} · отрасль {labelIndustry(industry)}
          </p>
        </div>

        {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
        {(ok || pending) && (
          <p className="text-sm font-semibold text-[var(--ok)]">Сохранено — переходим к тесту…</p>
        )}
        <button className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Переход…" : "Сохранить и к тесту"}
        </button>
      </form>
    </div>
  );
}
