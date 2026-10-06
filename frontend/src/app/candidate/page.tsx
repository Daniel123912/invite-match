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
}

export default function CandidateHome() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Profile>("/api/candidate/profile")
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!profile) return <p className="muted">Загрузка…</p>;

  const steps = [
    { ok: !!profile.full_name, label: "Профиль", href: "/candidate/profile" },
    { ok: !!profile.specialization && !!profile.selected_grade, label: "Опрос", href: "/candidate/survey" },
    { ok: !!profile.confirmed_grade, label: "Тест / категория", href: "/candidate/test" },
    { ok: true, label: "Приглашения", href: "/candidate/invitations" },
  ];

  return (
    <div className="grid gap-4">
      <div className="panel">
        <h2 className="text-xl font-bold">{profile.full_name || "Без имени"}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {profile.confirmed_grade ? (
            <span className="badge">
              Категория: {profile.specialization} × {profile.confirmed_grade}
            </span>
          ) : (
            <span className="badge">Категория ещё не присвоена</span>
          )}
          {profile.test_score != null && <span className="badge">Тест: {profile.test_score}%</span>}
          {profile.has_fsp_history ? (
            <span className="badge">ФСП: {profile.fsp_score} баллов</span>
          ) : (
            <span className="badge">Истории ФСП нет</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {steps.map((s) => (
          <Link key={s.href} href={s.href} className="panel hover:border-[var(--brand)]">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{s.label}</span>
              <span className="text-sm">{s.ok ? "✅" : "→"}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
