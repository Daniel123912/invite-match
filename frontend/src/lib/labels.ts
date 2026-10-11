export const SPECIALIZATIONS = [
  { value: "backend", label: "Backend" },
  { value: "frontend", label: "Frontend" },
  { value: "fullstack", label: "Fullstack" },
  { value: "devops", label: "DevOps" },
  { value: "data", label: "Data" },
  { value: "qa", label: "QA" },
  { value: "mobile", label: "Mobile" },
] as const;

export const GRADES = [
  { value: "junior", label: "Junior" },
  { value: "middle", label: "Middle" },
  { value: "senior", label: "Senior" },
] as const;

export const INDUSTRIES = [
  { value: "it", label: "IT" },
  { value: "fintech", label: "Fintech" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "edtech", label: "EdTech" },
  { value: "healthtech", label: "HealthTech" },
  { value: "other", label: "Другое" },
] as const;

export const INVITE_STATUS: Record<string, string> = {
  sent: "Отправлено",
  viewed: "Просмотрено",
  accepted: "Принято",
  declined: "Отклонено",
};

export function labelSpec(v?: string | null) {
  if (!v) return "—";
  return SPECIALIZATIONS.find((s) => s.value === v)?.label || v;
}

export function labelGrade(v?: string | null) {
  if (!v) return "—";
  return GRADES.find((g) => g.value === v)?.label || v;
}

export function labelIndustry(v?: string | null) {
  if (!v) return "—";
  return INDUSTRIES.find((i) => i.value === v)?.label || v;
}

export function labelInviteStatus(status: string) {
  return INVITE_STATUS[status] || status;
}

export function inviteStatusClass(status: string) {
  if (status === "accepted") return "badge-ok";
  if (status === "declined") return "!bg-[var(--danger-soft)] !text-[var(--danger)]";
  if (status === "viewed") return "!bg-[var(--warn-soft)] !text-[var(--warn)]";
  return "";
}

export const TASK_TYPES: Record<string, string> = {
  mcq: "Тест",
  code: "Код",
  open: "Открытый ответ",
};

export const TASK_STATUS: Record<string, string> = {
  pending: "Ожидает ответа",
  submitted: "На проверке",
  graded: "Проверено",
};

export function labelTaskType(v?: string | null) {
  if (!v) return "—";
  return TASK_TYPES[v] || v;
}

export function labelTaskStatus(v?: string | null) {
  if (!v) return "—";
  return TASK_STATUS[v] || v;
}

export function taskStatusClass(status: string) {
  if (status === "graded") return "badge-ok";
  if (status === "submitted") return "!bg-[var(--warn-soft)] !text-[var(--warn)]";
  return "badge-accent";
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
