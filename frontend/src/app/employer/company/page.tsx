"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { api, apiFetch, formatApiError } from "@/lib/api";
import { INDUSTRIES, labelIndustry } from "@/lib/labels";
import { formatPhoneInput, phoneToE164 } from "@/lib/masks";

interface Company {
  id?: number;
  name: string;
  description?: string;
  website?: string;
  industry?: string;
  city?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_telegram?: string;
  verified?: boolean;
  verification_note?: string;
  has_avatar?: boolean;
}

function initials(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export default function CompanyPage() {
  const [form, setForm] = useState<Company>({
    name: "",
    description: "",
    website: "",
    industry: "it",
    city: "",
    contact_email: "",
    contact_phone: "",
    contact_telegram: "",
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarTick, setAvatarTick] = useState(0);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarUrlRef = useRef<string | null>(null);

  useEffect(() => {
    api<Company | null>("/api/employer/company")
      .then((c) => {
        if (c) {
          setForm({
            ...c,
            contact_phone: c.contact_phone ? formatPhoneInput(c.contact_phone) : c.contact_phone,
          });
        }
      })
      .catch((e) => setError(formatApiError(e, "Не удалось загрузить компанию")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAvatar() {
      if (!form.has_avatar || !form.id) {
        if (avatarUrlRef.current) {
          URL.revokeObjectURL(avatarUrlRef.current);
          avatarUrlRef.current = null;
        }
        setAvatarUrl(null);
        return;
      }
      try {
        const res = await apiFetch("/api/employer/company/avatar");
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
        avatarUrlRef.current = url;
        setAvatarUrl(url);
      } catch {
        if (!cancelled) {
          if (avatarUrlRef.current) {
            URL.revokeObjectURL(avatarUrlRef.current);
            avatarUrlRef.current = null;
          }
          setAvatarUrl(null);
        }
      }
    }

    void loadAvatar();
    return () => {
      cancelled = true;
    };
  }, [form.has_avatar, form.id, avatarTick]);

  useEffect(() => {
    return () => {
      if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const saved = await api<Company>("/api/employer/company", {
        method: "PUT",
        body: {
          ...form,
          contact_phone: form.contact_phone
            ? phoneToE164(form.contact_phone) || form.contact_phone
            : form.contact_phone,
        },
      });
      setForm({
        ...saved,
        contact_phone: saved.contact_phone
          ? formatPhoneInput(saved.contact_phone)
          : saved.contact_phone,
      });
      setMsg("Сохранено");
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function requestVerify() {
    setError("");
    setMsg("");
    try {
      await api("/api/employer/company/verify-request", { method: "POST" });
      setMsg("Заявка на верификацию отправлена");
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function onAvatarSelected(file: File | null) {
    if (!file) return;
    if (!form.id) {
      setError("Сначала сохраните профиль компании — потом можно добавить логотип");
      return;
    }
    setError("");
    setMsg("");
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const updated = await api<Company>("/api/employer/company/avatar", {
        method: "POST",
        body: fd,
      });
      setForm((f) => ({
        ...f,
        ...updated,
        contact_phone: f.contact_phone,
      }));
      setAvatarTick((n) => n + 1);
      setMsg("Логотип обновлён");
    } catch (err) {
      setError(formatApiError(err, "Не удалось загрузить логотип"));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function removeAvatar() {
    if (!form.has_avatar) return;
    setError("");
    setAvatarUploading(true);
    try {
      const updated = await api<Company>("/api/employer/company/avatar", { method: "DELETE" });
      setForm((f) => ({
        ...f,
        ...updated,
        contact_phone: f.contact_phone,
      }));
      setAvatarTick((n) => n + 1);
      setMsg("Логотип удалён");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setAvatarUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="fsp-soft-block empty-state">
        <p className="muted">Загрузка…</p>
      </div>
    );
  }

  const industryLabel = labelIndustry(form.industry);
  const cityTag = form.city?.trim();
  const canUploadAvatar = Boolean(form.id);

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <header className="fsp-profile-hero">
        <div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            disabled={avatarUploading || !canUploadAvatar}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              void onAvatarSelected(f);
            }}
          />
          <button
            type="button"
            className="fsp-avatar fsp-avatar-btn"
            disabled={avatarUploading || !canUploadAvatar}
            onClick={() => avatarInputRef.current?.click()}
            aria-label={form.has_avatar ? "Сменить логотип" : "Добавить логотип"}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" />
            ) : (
              <span aria-hidden>{initials(form.name)}</span>
            )}
            <span className="fsp-avatar-hint">
              {avatarUploading ? "…" : form.has_avatar ? "сменить" : "фото"}
            </span>
          </button>
          {form.has_avatar && (
            <div className="fsp-avatar-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={avatarUploading}
                onClick={() => void removeAvatar()}
              >
                Удалить фото
              </button>
            </div>
          )}
          {!canUploadAvatar && (
            <p className="mt-2 text-xs text-[var(--warn)]">
              Сохраните профиль — затем можно добавить логотип
            </p>
          )}
        </div>
        <div className="fsp-profile-meta">
          <h1 className="fsp-profile-name">
            <span>{form.name?.trim() || "Название компании"}</span>
            {form.verified ? (
              <span className="badge badge-ok">верифицирована</span>
            ) : (
              <span className="status-dot brand" aria-hidden />
            )}
          </h1>
          <p className="fsp-company-line">
            {form.website?.trim() || "Сайт ещё не указан"}
            {cityTag ? ` · ${cityTag}` : ""}
          </p>
          <p className="fsp-skills-label">Направление деятельности</p>
          <div className="fsp-skill-row">
            <span className="fsp-skill">{industryLabel}</span>
            {cityTag ? <span className="fsp-skill ghost">{cityTag}</span> : null}
          </div>
          <p className="muted mt-3 text-sm">
            Профиль нужен, чтобы отправлять приглашения кандидатам
          </p>
        </div>
      </header>

      <section className="fsp-soft-block">
        <h2 className="fsp-soft-block-title">Основная информация</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="field md:col-span-2">
            <label>Название</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Сайт</label>
            <input
              value={form.website || ""}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://"
            />
          </div>
          <div className="field">
            <label>Город</label>
            <input
              value={form.city || ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div className="field md:col-span-2">
            <label>Отрасль</label>
            <select
              value={form.industry || "it"}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            >
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field md:col-span-2">
            <label>Описание (обязательно, мин. 20 символов)</label>
            <textarea
              rows={5}
              required
              minLength={20}
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Чем занимается компания"
            />
          </div>
        </div>
      </section>

      <section className="fsp-soft-block">
        <h2 className="fsp-soft-block-title">Контакты</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="field md:col-span-2">
            <label>Контактный email</label>
            <input
              type="email"
              value={form.contact_email || ""}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              placeholder="hr@company.ru"
            />
          </div>
          <div className="field">
            <label>Контактный телефон</label>
            <input
              value={form.contact_phone || ""}
              onChange={(e) => setForm({ ...form, contact_phone: formatPhoneInput(e.target.value) })}
              placeholder="+7 (___) ___-__-__"
              inputMode="tel"
            />
          </div>
          <div className="field">
            <label>Telegram</label>
            <input
              value={form.contact_telegram || ""}
              onChange={(e) => setForm({ ...form, contact_telegram: e.target.value })}
              placeholder="@hr_team"
            />
          </div>
        </div>
        <p className="muted mt-3 text-xs">Нужен хотя бы один способ связи — он попадёт в приглашения</p>
      </section>

      <section className="fsp-soft-block">
        <h2 className="fsp-soft-block-title">Проверка компании</h2>
        {form.verified && (
          <p className="text-sm font-semibold text-[var(--ok)]">Компания верифицирована</p>
        )}
        {form.verification_note && <p className="muted mt-1 text-xs">{form.verification_note}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ghost" onClick={requestVerify}>
            Запросить проверку компании
          </button>
          <button className="btn btn-primary">Сохранить</button>
          <Link href="/employer/needs" className="btn btn-ghost">
            Далее: потребность →
          </Link>
        </div>
        {msg && <p className="mt-3 text-sm font-semibold text-[var(--ok)]">{msg}</p>}
        {error && <p className="mt-3 text-sm font-semibold text-[var(--danger)]">{error}</p>}
      </section>
    </form>
  );
}
