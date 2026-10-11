"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  PACK_ACHIEVEMENTS,
  achievementIconSrc,
  getVisitStats,
  isPackAchievementUnlocked,
  packAchievementDetail,
  packAchievementHref,
  recordCandidateVisit,
} from "@/lib/achievements";
import { api, formatApiError } from "@/lib/api";

interface Profile {
  full_name: string;
  phone?: string;
  city?: string;
  stack?: string;
  about?: string;
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

interface FspAchievement {
  id: number;
  fsp_id: string;
  title: string;
  points: number;
  achieved_at?: string | null;
}

interface FspProfile {
  fsp_id: string;
  has_history: boolean;
  total_points: number;
  achievements: FspAchievement[];
  note?: string;
}

type Filter = "all" | "pack" | "fsp";

type AchievementCard = {
  id: string;
  source: "pack" | "fsp";
  title: string;
  detail: string;
  points?: number;
  done: boolean;
  href?: string;
  actionLabel?: string;
  iconSrc?: string;
};

export default function CandidateAchievementsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fsp, setFsp] = useState<FspProfile | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [visit, setVisit] = useState({ streak: 0, nightOwl: false });

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    recordCandidateVisit(userId);
    setVisit(getVisitStats(userId));

    api<Profile>("/api/candidate/profile")
      .then(async (p) => {
        setProfile(p);
        if (p.fsp_id?.trim()) {
          try {
            const data = await api<FspProfile>(
              `/api/fsp/${encodeURIComponent(p.fsp_id.trim())}/achievements`,
            );
            setFsp(data);
          } catch {
            setFsp(null);
          }
        } else {
          setFsp(null);
        }
      })
      .catch((e) => setError(formatApiError(e)));
  }, []);

  const cards = useMemo<AchievementCard[]>(() => {
    if (!profile) return [];

    const pack: AchievementCard[] = PACK_ACHIEVEMENTS.map((a) => {
      const done = isPackAchievementUnlocked(a.id, profile, visit);
      return {
        id: a.id,
        source: "pack" as const,
        title: a.title,
        detail: packAchievementDetail(a.id, a.description, visit),
        done,
        href: packAchievementHref(a.id),
        actionLabel: done ? "Открыть" : "Добавить",
        iconSrc: achievementIconSrc(a.icon),
      };
    });

    const fromFsp: AchievementCard[] = (fsp?.achievements || []).map((a) => ({
      id: `fsp-${a.id}`,
      source: "fsp" as const,
      title: a.title,
      detail: a.achieved_at
        ? `ФСП · ${new Date(a.achieved_at).toLocaleDateString("ru-RU")}`
        : "Достижение из истории ФСП",
      points: a.points,
      done: true,
      href: "/candidate/settings",
      actionLabel: "Открыть",
      iconSrc: achievementIconSrc("test_master.svg"),
    }));

    return [...pack, ...fromFsp];
  }, [profile, fsp, visit]);

  const visible = cards.filter((c) => filter === "all" || c.source === filter);
  const doneCount = cards.filter((c) => c.done).length;

  if (error) {
    return (
      <div className="fsp-soft-block empty-state">
        <p className="font-semibold text-[var(--danger)]">Не удалось загрузить достижения</p>
        <p className="muted text-sm">{error}</p>
        <button className="btn btn-ghost mt-2" onClick={() => window.location.reload()}>
          Обновить
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fsp-soft-block empty-state">
        <p className="muted">Загрузка достижений…</p>
      </div>
    );
  }

  return (
    <div className="fsp-achievements">
      <div className="fsp-achievements-head">
        <h1 className="fsp-achievements-title">
          {doneCount} {doneCount === 1 ? "достижение" : doneCount < 5 ? "достижения" : "достижений"}
        </h1>
        <div className="fsp-achievements-filters" role="tablist" aria-label="Фильтр достижений">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`fsp-filter-pill${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Все
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "pack"}
            className={`fsp-filter-pill${filter === "pack" ? " active" : ""}`}
            onClick={() => setFilter("pack")}
          >
            Invite Match
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "fsp"}
            className={`fsp-filter-pill${filter === "fsp" ? " active" : ""}`}
            onClick={() => setFilter("fsp")}
          >
            ФСП
          </button>
        </div>
      </div>

      {!profile.fsp_id && filter !== "pack" && (
        <div className="fsp-soft-block !py-4 mb-1">
          <p className="text-sm">
            Чтобы подтянуть историю ФСП, укажите FSP ID в{" "}
            <Link href="/candidate/settings" className="font-semibold text-[var(--brand)] underline">
              настройках
            </Link>
            .
          </p>
        </div>
      )}

      {profile.fsp_id && fsp && !fsp.has_history && filter !== "pack" && (
        <div className="fsp-soft-block !py-4 mb-1">
          <p className="text-sm muted">
            По ID {fsp.fsp_id} история достижений пока пуста. В подборке учитывается тест.
          </p>
        </div>
      )}

      <ul className="fsp-achievements-list">
        {visible.map((item, index) => (
          <li
            key={item.id}
            className={`fsp-achievement-card${item.done ? " done" : " locked"}`}
            style={{ animationDelay: `${Math.min(index, 6) * 0.05}s` }}
          >
            <div className={`fsp-achievement-icon${item.done ? "" : " locked"}`}>
              {item.iconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.iconSrc} alt="" width={40} height={40} className="fsp-achievement-svg" />
              ) : null}
            </div>
            <div className="fsp-achievement-body">
              <div className="fsp-achievement-top">
                <p className="fsp-achievement-title">{item.title}</p>
                {item.points != null && (
                  <span className="badge">{Math.round(item.points)} баллов</span>
                )}
              </div>
              <p className="fsp-achievement-detail">{item.detail}</p>
              <div className="fsp-achievement-actions">
                {item.done ? (
                  <span className="badge badge-ok">Получено</span>
                ) : (
                  <span className="badge">Заблокировано</span>
                )}
                {item.href && (
                  <Link
                    href={item.href}
                    className={`btn ${item.done ? "btn-ghost" : "btn-primary"} fsp-achievement-cta`}
                  >
                    {item.actionLabel || "Добавить"}
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}

        {visible.length === 0 && (
          <li className="fsp-achievement-card empty">
            <p className="muted text-sm">В этом фильтре пока нет достижений</p>
          </li>
        )}
      </ul>
    </div>
  );
}
