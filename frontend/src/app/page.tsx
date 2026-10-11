"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  cabinetPath,
  clearAuth,
  getRole,
  isAuthenticated,
  subscribeAuth,
  type Role,
} from "@/lib/api";

function getAuthRoleSnapshot(): Role | null {
  return isAuthenticated() ? getRole() : null;
}

function getServerAuthRoleSnapshot(): Role | null {
  return null;
}

export default function HomePage() {
  const role = useSyncExternalStore(
    subscribeAuth,
    getAuthRoleSnapshot,
    getServerAuthRoleSnapshot,
  );
  const cabinet = cabinetPath(role);
  const loggedIn = Boolean(role && cabinet);

  return (
    <div className="min-h-screen flex flex-col max-w-[1200px] mx-auto px-4 md:px-8 py-6">
      <header className="flex items-center justify-between mb-10">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="ФСП"
            width={269}
            height={97}
            className="h-10 w-auto"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-2 text-sm font-semibold text-[#6B7280]">
          <Link
            href="/register?role=candidate"
            className="bg-[#F3F4F6] px-4 py-2 rounded-full hover:bg-[#E5E7EB] hover:text-[#1A1A1A] transition-colors"
          >
            Кандидатам
          </Link>
          <Link
            href="/register?role=employer"
            className="bg-[#F3F4F6] px-4 py-2 rounded-full hover:bg-[#E5E7EB] hover:text-[#1A1A1A] transition-colors"
          >
            Работодателям
          </Link>
          <Link href="/about" className="px-3 py-2 hover:text-[#1A1A1A] transition-colors">
            О платформе
          </Link>
        </nav>

        <div className="flex items-center gap-3 text-sm font-semibold">
          {loggedIn ? (
            <>
              <button
                type="button"
                onClick={() => clearAuth()}
                className="hidden sm:block text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
              >
                Выйти
              </button>
              <Link
                href={cabinet!}
                className="bg-[#8B7CF6] hover:bg-[#7A6BE5] text-white px-6 py-2.5 rounded-full transition-colors"
              >
                В кабинет
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="hidden sm:block text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
              >
                Регистрация
              </Link>
              <Link
                href="/login"
                className="bg-[#8B7CF6] hover:bg-[#7A6BE5] text-white px-6 py-2.5 rounded-full transition-colors"
              >
                Войти
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="bg-[#F3F3F3] rounded-[40px] p-8 md:p-14 flex flex-col md:flex-row items-center gap-10 overflow-hidden">
          <div className="flex-1 flex flex-col items-start max-w-xl relative z-10">
            <h1 className="text-3xl md:text-[42px] font-bold leading-[1.15] tracking-tight mb-5 text-[#1A1A1A]">
              Ваши достижения в спортивном программировании — теперь карьерное преимущество
            </h1>
            <p className="text-[#6B7280] text-base md:text-lg mb-8 leading-relaxed">
              Подтверждайте навыки задачами и получайте приглашения от работодателей, которым важны
              реальные результаты, а не только резюме.
            </p>

            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
              {loggedIn ? (
                <Link
                  href={cabinet!}
                  className="bg-[#8B7CF6] hover:bg-[#7A6BE5] text-white px-8 py-3 rounded-full text-sm font-medium transition-colors text-center w-full sm:w-auto"
                >
                  Вернуться в кабинет
                </Link>
              ) : (
                <>
                  <Link
                    href="/register?role=candidate"
                    className="bg-[#8B7CF6] hover:bg-[#7A6BE5] text-white px-8 py-3 rounded-full text-sm font-medium transition-colors text-center w-full sm:w-auto"
                  >
                    Я кандидат
                  </Link>
                  <Link
                    href="/register?role=employer"
                    className="bg-[#8B7CF6] hover:bg-[#7A6BE5] text-white px-8 py-3 rounded-full text-sm font-medium transition-colors text-center w-full sm:w-auto"
                  >
                    Я работодатель
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 flex justify-center md:justify-end w-full min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/girl.svg"
              alt=""
              width={607}
              height={513}
              className="block w-full max-w-[480px] h-auto object-contain object-bottom select-none"
              decoding="async"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
