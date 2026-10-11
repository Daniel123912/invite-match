"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import {
  cabinetPath,
  getRole,
  isAuthenticated,
  subscribeAuth,
  type Role,
} from "@/lib/api";

function getRoleSnapshot(): Role | null {
  return isAuthenticated() ? getRole() : null;
}

function getServerRoleSnapshot(): Role | null {
  return null;
}

function roleMatches(role: Role | null, expected: Role): boolean {
  if (!role) return false;
  if (role === expected) return true;
  // admin ходит в кабинет кандидата
  if (expected === "candidate" && role === "admin") return true;
  return false;
}

type CabinetAuthGateProps = {
  expected: Role;
  children: ReactNode;
  /** Вызывается, когда роль подтверждена (например, запись визита). */
  onAuthorized?: () => void;
};

export function CabinetAuthGate({ expected, children, onAuthorized }: CabinetAuthGateProps) {
  const role = useSyncExternalStore(subscribeAuth, getRoleSnapshot, getServerRoleSnapshot);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && roleMatches(role, expected)) {
      onAuthorized?.();
    }
  }, [ready, role, expected, onAuthorized]);

  if (!ready) {
    return (
      <div className="fsp-cabinet page-enter flex flex-1 items-center justify-center px-4">
        <p className="muted text-sm">Проверяем вход…</p>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="fsp-cabinet page-enter flex flex-1 items-center justify-center px-4">
        <div className="panel panel-solid max-w-md w-full text-center p-8">
          <h1 className="cabinet-title text-xl">Нужен вход</h1>
          <p className="muted mt-3 text-sm leading-relaxed">
            Кабинет {expected === "candidate" ? "кандидата" : "работодателя"} доступен только после
            авторизации.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="btn btn-primary">
              Войти
            </Link>
            <Link href="/register" className="btn btn-ghost">
              Регистрация
            </Link>
          </div>
          <p className="muted mt-5 text-xs">
            <Link href="/" className="link-quiet">
              На главную
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (!roleMatches(role, expected)) {
    const otherHref = cabinetPath(role) ?? "/login";
    const otherLabel =
      role === "employer" ? "кабинет работодателя" : "кабинет кандидата";
    return (
      <div className="fsp-cabinet page-enter flex flex-1 items-center justify-center px-4">
        <div className="panel panel-solid max-w-md w-full text-center p-8">
          <h1 className="cabinet-title text-xl">Другой тип аккаунта</h1>
          <p className="muted mt-3 text-sm leading-relaxed">
            Этот раздел для {expected === "candidate" ? "кандидатов" : "работодателей"}. Сейчас вы
            вошли как {role === "employer" ? "работодатель" : "кандидат"}.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href={otherHref} className="btn btn-primary">
              Открыть {otherLabel}
            </Link>
            <Link href="/login" className="btn btn-ghost">
              Сменить аккаунт
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function useAuthRole() {
  return useSyncExternalStore(subscribeAuth, getRoleSnapshot, getServerRoleSnapshot);
}
