"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function SurveyPage() {
  const router = useRouter();
  const [industry, setIndustry] = useState("it");
  const [specialization, setSpecialization] = useState("backend");
  const [grade, setGrade] = useState("junior");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/candidate/survey", {
        method: "POST",
        body: JSON.stringify({
          industry,
          specialization,
          selected_grade: grade,
        }),
      });
      setOk(true);
      setTimeout(() => router.push("/candidate/test"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel mx-auto max-w-lg space-y-4">
      <h2 className="text-xl font-bold">Опрос перед тестом</h2>
      <p className="muted text-sm">
        Грейд выбираете сами — тест подтвердит или нет. Категория = специализация × грейд.
      </p>
      <div className="field">
        <label>Отрасль</label>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="it">IT</option>
          <option value="fintech">Fintech</option>
          <option value="ecommerce">E-commerce</option>
          <option value="edtech">EdTech</option>
          <option value="healthtech">HealthTech</option>
          <option value="other">Другое</option>
        </select>
      </div>
      <div className="field">
        <label>Специализация</label>
        <select value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
          <option value="backend">Backend</option>
          <option value="frontend">Frontend</option>
          <option value="fullstack">Fullstack</option>
          <option value="devops">DevOps</option>
          <option value="data">Data</option>
          <option value="qa">QA</option>
          <option value="mobile">Mobile</option>
        </select>
      </div>
      <div className="field">
        <label>Целевой грейд</label>
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="junior">Junior</option>
          <option value="middle">Middle</option>
          <option value="senior">Senior</option>
        </select>
      </div>
      {error && <p className="text-[var(--danger)] text-sm">{error}</p>}
      {ok && <p className="text-[var(--ok)] text-sm">Сохранено — переходим к тесту…</p>}
      <button className="btn btn-primary w-full">Сохранить и к тесту</button>
    </form>
  );
}
