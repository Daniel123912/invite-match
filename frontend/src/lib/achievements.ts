export type PackAchievement = {
  id: string;
  title: string;
  description: string;
  trigger: string;
  icon: string;
  available_when?: string;
};

export const PACK_ACHIEVEMENTS: PackAchievement[] = [
  {
    id: "first_test",
    title: "Первый шаг",
    description: "Пройти и завершить первый тест",
    trigger: "first_test_completed",
    icon: "first_test.svg",
  },
  {
    id: "python_junior",
    title: "Python Junior",
    description: "Успешно пройти тест Python уровня Junior",
    trigger: "python_junior_passed",
    icon: "python_junior.svg",
  },
  {
    id: "python_middle",
    title: "Python Middle",
    description: "Успешно пройти тест Python уровня Middle",
    trigger: "python_middle_passed",
    icon: "python_middle.svg",
  },
  {
    id: "versatile",
    title: "Универсал",
    description: "Успешно пройти тесты по 3 разным направлениям",
    trigger: "three_tracks_passed",
    icon: "versatile.svg",
  },
  {
    id: "test_master",
    title: "Мастер тестов",
    description: "Успешно пройти 5 разных тестов",
    trigger: "five_distinct_tests_passed",
    icon: "test_master.svg",
  },
  {
    id: "week_streak",
    title: "7 дней в деле",
    description: "Заходить на платформу 7 дней подряд",
    trigger: "seven_day_login_streak",
    icon: "week_streak.svg",
  },
  {
    id: "night_owl",
    title: "Ночная сова",
    description: "Зайти на платформу между 00:00 и 05:00 по локальному времени",
    trigger: "login_between_00_and_05",
    icon: "night_owl.svg",
  },
  {
    id: "profile_ready",
    title: "Профиль готов",
    description: "Заполнить обязательные поля профиля кандидата",
    trigger: "candidate_profile_completed",
    icon: "profile_ready.svg",
  },
];

type VisitStore = {
  /** YYYY-MM-DD локальные даты входов */
  days: string[];
  nightOwl: boolean;
  updatedAt: string;
};

const VISIT_KEY_PREFIX = "fsp_visit_track_v1";

function visitKey(userId?: string | null) {
  return `${VISIT_KEY_PREFIX}:${userId || "anon"}`;
}

function localDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readStore(userId?: string | null): VisitStore {
  if (typeof window === "undefined") {
    return { days: [], nightOwl: false, updatedAt: "" };
  }
  try {
    const raw = localStorage.getItem(visitKey(userId));
    if (!raw) return { days: [], nightOwl: false, updatedAt: "" };
    const parsed = JSON.parse(raw) as VisitStore;
    return {
      days: Array.isArray(parsed.days) ? parsed.days.filter((x) => typeof x === "string") : [],
      nightOwl: Boolean(parsed.nightOwl),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return { days: [], nightOwl: false, updatedAt: "" };
  }
}

function writeStore(userId: string | null | undefined, store: VisitStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(visitKey(userId), JSON.stringify(store));
}

/** Считает текущую серию подряд идущих календарных дней (локальное время). */
export function computeLoginStreak(days: string[], today = localDayKey()) {
  const set = new Set(days);
  if (!set.has(today)) {
    // серия считается только если сегодня уже был вход
    const yesterday = shiftDay(today, -1);
    if (!set.has(yesterday)) return 0;
    let streak = 0;
    let cursor = yesterday;
    while (set.has(cursor)) {
      streak += 1;
      cursor = shiftDay(cursor, -1);
    }
    return streak;
  }
  let streak = 0;
  let cursor = today;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

function shiftDay(dayKey: string, delta: number) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return localDayKey(dt);
}

/**
 * Временный учёт входов в localStorage (до серверного трекинга).
 * Пишет сегодняшний день и флаг ночного входа 00:00–05:00.
 */
export function recordCandidateVisit(userId?: string | null, now = new Date()): VisitStore {
  const store = readStore(userId);
  const day = localDayKey(now);
  const days = store.days.includes(day) ? store.days : [...store.days, day].slice(-60);
  const hour = now.getHours();
  const nightOwl = store.nightOwl || (hour >= 0 && hour < 5);
  const next: VisitStore = {
    days,
    nightOwl,
    updatedAt: now.toISOString(),
  };
  writeStore(userId, next);
  return next;
}

export function getVisitStats(userId?: string | null) {
  const store = readStore(userId);
  const streak = computeLoginStreak(store.days);
  return {
    days: store.days,
    streak,
    nightOwl: store.nightOwl,
    weekStreakUnlocked: streak >= 7,
  };
}

export function achievementIconSrc(icon: string) {
  return `/achievements/${icon}`;
}

/** Клиентская оценка для UI (серверная выдача — отдельно). */
export function isPackAchievementUnlocked(
  id: string,
  profile: {
    full_name?: string;
    phone?: string;
    city?: string;
    stack?: string;
    about?: string;
    specialization?: string;
    selected_grade?: string;
    confirmed_grade?: string;
    test_score?: number;
  },
  visit?: { streak: number; nightOwl: boolean },
) {
  const profileReady = Boolean(
    profile.full_name?.trim() &&
      (profile.phone?.trim() || profile.city?.trim() || profile.stack?.trim() || profile.about?.trim()),
  );
  const testDone = Boolean(profile.confirmed_grade);
  const grade = (profile.confirmed_grade || "").toLowerCase();
  const stats = visit || getVisitStats();

  switch (id) {
    case "profile_ready":
      return profileReady;
    case "first_test":
      return testDone || profile.test_score != null;
    case "python_junior":
      return testDone && grade === "junior";
    case "python_middle":
      return testDone && (grade === "middle" || grade === "senior");
    case "week_streak":
      return stats.streak >= 7;
    case "night_owl":
      return stats.nightOwl;
    default:
      return false;
  }
}

export function packAchievementDetail(
  id: string,
  base: string,
  visit?: { streak: number; nightOwl: boolean },
) {
  const stats = visit || getVisitStats();
  if (id === "week_streak") {
    return `${base} · сейчас ${Math.min(stats.streak, 7)}/7 дней (локально)`;
  }
  if (id === "night_owl" && !stats.nightOwl) {
    return `${base} · зайдите между 00:00 и 05:00 (локально)`;
  }
  return base;
}

export function packAchievementHref(id: string) {
  if (id === "profile_ready") return "/candidate/profile";
  if (
    id === "first_test" ||
    id === "python_junior" ||
    id === "python_middle" ||
    id === "versatile" ||
    id === "test_master"
  ) {
    return "/candidate/test";
  }
  return "/candidate";
}
