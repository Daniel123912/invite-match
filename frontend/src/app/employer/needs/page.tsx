"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { GRADES, SPECIALIZATIONS, labelGrade, labelSpec } from "@/lib/labels";

function stackTags(stack?: string) {
  return (stack || "")
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function formatSalary(from: number, to: number) {
  return `${from.toLocaleString("ru-RU")} – ${to.toLocaleString("ru-RU")} ₽`;
}

export default function NeedsPage() {
  const [title, setTitle] = useState("Backend Middle");
  const [specialization, setSpecialization] = useState("backend");
  const [grade, setGrade] = useState("middle");
  const [stack, setStack] = useState("Python, FastAPI");
  const [salaryFrom, setSalaryFrom] = useState(200000);
  const [salaryTo, setSalaryTo] = useState(350000);
  const [description, setDescription] = useState(
    "Ищем разработчика для продуктовой команды: API, интеграции, код-ревью.",
  );
  const [salaryGross, setSalaryGross] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastCreated, setLastCreated] = useState<{
    id: number;
    specialization: string;
    grade: string;
    stack?: string;
  } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    setSaving(true);
    try {
      const created = await api<{ id: number }>("/api/employer/needs", {
        method: "POST",
        body: {
          title,
          specialization,
          grade,
          stack,
          description,
          salary_from: salaryFrom,
          salary_to: salaryTo,
          salary_gross: salaryGross,
        },
      });
      setLastCreated({ id: created.id, specialization, grade, stack });
      setOk("Вакансия опубликована");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  const matchHref = lastCreated
    ? `/employer/match?need_id=${lastCreated.id}&specialization=${lastCreated.specialization}&grade=${lastCreated.grade}&stack=${encodeURIComponent(lastCreated.stack || "")}`
    : "/employer/match";

  const previewTags = useMemo(() => stackTags(stack), [stack]);
  const descLen = description.trim().length;

  return (
    <div className="fsp-vacancy">
      <header className="fsp-vacancy-hero">
        <div>
          <p className="fsp-vacancy-hero-kicker">Hiring desk</p>
          <h1 className="fsp-vacancy-hero-title">Новая вакансия</h1>
          <p className="fsp-vacancy-hero-lead">
            Опишите роль один раз — система подберёт категорию и кандидатов. Управлять списком можно
            во вкладке «Мои вакансии».
          </p>
        </div>
        <Link href="/employer/vacancies" className="btn btn-ghost">
          Мои вакансии →
        </Link>
      </header>

      <div className="fsp-vacancy-layout">
        <form onSubmit={onSubmit} className="fsp-soft-block fsp-vacancy-form">
          <div>
            <h2 className="fsp-soft-block-title !mb-1">Параметры роли</h2>
            <p className="muted text-sm">Заполните коротко и по делу — этого хватит для точной подборки</p>
          </div>

          <div className="fsp-vacancy-section">
            <h3 className="fsp-vacancy-section-title">
              <span className="fsp-vacancy-step">1</span>
              Роль
            </h3>
            <div className="grid gap-3">
              <div className="field">
                <label>Заголовок</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Например: Backend Middle / Python"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="field">
                  <label>Специализация</label>
                  <select
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                  >
                    {SPECIALIZATIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Грейд</label>
                  <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                    {GRADES.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Стек</label>
                <input
                  value={stack}
                  onChange={(e) => setStack(e.target.value)}
                  placeholder="Python, FastAPI, PostgreSQL"
                />
                <p className="muted mt-1 text-xs">Через запятую — так теги попадут в карточку</p>
              </div>
            </div>
          </div>

          <div className="fsp-vacancy-section">
            <h3 className="fsp-vacancy-section-title">
              <span className="fsp-vacancy-step">2</span>
              Компенсация
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="field">
                <label>Зарплата от, ₽</label>
                <input
                  type="number"
                  value={salaryFrom}
                  onChange={(e) => setSalaryFrom(Number(e.target.value))}
                  required
                />
              </div>
              <div className="field">
                <label>Зарплата до, ₽</label>
                <input
                  type="number"
                  value={salaryTo}
                  onChange={(e) => setSalaryTo(Number(e.target.value))}
                  required
                />
              </div>
            </div>
            <label className="mt-3 flex items-start gap-2.5 text-sm leading-snug">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={salaryGross}
                onChange={(e) => setSalaryGross(e.target.checked)}
              />
              <span>
                Зарплата до вычета НДФЛ (gross)
                <span className="muted mt-0.5 block text-xs">
                  Снимите галочку, если указываете сумму «на руки»
                </span>
              </span>
            </label>
          </div>

          <div className="fsp-vacancy-section">
            <h3 className="fsp-vacancy-section-title">
              <span className="fsp-vacancy-step">3</span>
              Описание
            </h3>
            <div className="field">
              <label>Чем предстоит заниматься (мин. 20 символов)</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={20}
                placeholder="Команда, задачи, стек, формат работы"
              />
              <p className={`mt-1 text-xs ${descLen < 20 ? "text-[var(--warn)]" : "muted"}`}>
                {descLen}/20+ символов
              </p>
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}

          {ok && (
            <div className="fsp-vacancy-success">
              <p className="text-sm font-semibold text-[var(--ok)]">{ok}</p>
              <div className="flex flex-wrap gap-2">
                <Link href={matchHref} className="btn btn-primary">
                  Открыть подборку →
                </Link>
                <Link href="/employer/vacancies" className="btn btn-ghost">
                  К списку вакансий
                </Link>
              </div>
            </div>
          )}

          <div className="fsp-vacancy-actions">
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Сохраняем…" : "Опубликовать вакансию"}
            </button>
            <p className="muted text-xs">После публикации можно искать кандидатов или управлять списком</p>
          </div>
        </form>

        <aside className="fsp-vacancy-preview">
          <p className="fsp-vacancy-preview-label">Превью карточки</p>
          <article className="fsp-vacancy-card">
            <div className="fsp-vacancy-card-top">
              <div>
                <h3 className="fsp-vacancy-card-title">
                  {title.trim() || "Заголовок вакансии"}
                </h3>
                <p className="fsp-vacancy-card-meta">
                  {labelSpec(specialization)} · {labelGrade(grade)}
                </p>
              </div>
              <p className="fsp-vacancy-salary">
                {formatSalary(salaryFrom || 0, salaryTo || 0)}
                <span>{salaryGross ? "gross" : "net / на руки"}</span>
              </p>
            </div>
            <div className="fsp-vacancy-tags">
              {(previewTags.length ? previewTags : ["стек"]).map((tag) => (
                <span key={tag} className="fsp-skill ghost">
                  {tag}
                </span>
              ))}
            </div>
            <p className="muted line-clamp-3 text-sm leading-relaxed">
              {description.trim() || "Краткое описание появится здесь"}
            </p>
          </article>
        </aside>
      </div>
    </div>
  );
}
