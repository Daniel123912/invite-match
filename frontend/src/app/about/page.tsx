import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "О платформе — ФСП",
  description:
    "ФСП — платформа, где навыки подтверждаются тестом, а достижения спортивного программирования усиливают карьерный матч с работодателями.",
};

const steps = [
  {
    title: "Опрос и выбор трека",
    text: "Кандидат указывает отрасль, специализацию и желаемый грейд — от этого зависит вариант теста.",
  },
  {
    title: "Тест подтверждает грейд",
    text: "Категория и грейд назначаются только по результату теста (≥ 60%). Резюме и ФСП грейд не меняют.",
  },
  {
    title: "ФСП усиливает позицию",
    text: "История спортивного программирования участвует в ранжировании внутри категории — реальные результаты видны в подборке.",
  },
  {
    title: "Приглашение и контакты",
    text: "Работодатель зовёт конкретного человека с вилкой зарплаты. Контакты открываются только после принятия приглашения.",
  },
] as const;

const audiences = [
  {
    title: "Кандидатам",
    points: [
      "Подтвердите грейд задачами, а не только словами в резюме",
      "Подтяните историю ФСП и покажите спортивные достижения",
      "Получайте приглашения от компаний, которым важны навыки",
    ],
    href: "/register?role=candidate",
    cta: "Стать кандидатом",
  },
  {
    title: "Работодателям",
    points: [
      "Ищите людей по подтверждённой категории и грейду",
      "Смотрите прозрачный ранг: тест и вклад ФСП",
      "Приглашайте с оффером — контакты после согласия кандидата",
    ],
    href: "/register?role=employer",
    cta: "Стать работодателем",
  },
] as const;

export default function AboutPage() {
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
          <Link href="/about" className="px-3 py-2 text-[#1A1A1A]">
            О платформе
          </Link>
        </nav>

        <div className="flex items-center gap-3 text-sm font-semibold">
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
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-8 md:gap-12 pb-12">
        <section className="bg-[#F3F3F3] rounded-[40px] p-8 md:p-14 overflow-hidden">
          <p className="text-sm font-semibold text-[#8B7CF6] mb-3 tracking-wide">
            О платформе
          </p>
          <h1 className="font-display text-3xl md:text-[42px] font-bold leading-[1.15] tracking-tight mb-5 text-[#1A1A1A] max-w-3xl">
            Навыки подтверждаются тестом. Достижения ФСП становятся карьерным аргументом.
          </h1>
          <p className="text-[#6B7280] text-base md:text-lg leading-relaxed max-w-2xl">
            ФСП — платформа подбора ИТ-специалистов: кандидат проходит опрос и тест, получает
            категорию, а работодатель находит людей по реальным результатам и приглашает напрямую.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-6 md:gap-8">
          {audiences.map((block) => (
            <div
              key={block.title}
              className="bg-white/70 border border-[#E5E7EB] rounded-[32px] p-8 md:p-10 flex flex-col"
            >
              <h2 className="text-2xl font-bold text-[#1A1A1A] mb-5">{block.title}</h2>
              <ul className="space-y-3 text-[#6B7280] leading-relaxed mb-8 flex-1">
                {block.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B7CF6]"
                      aria-hidden
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={block.href}
                className="self-start bg-[#8B7CF6] hover:bg-[#7A6BE5] text-white px-7 py-3 rounded-full text-sm font-medium transition-colors"
              >
                {block.cta}
              </Link>
            </div>
          ))}
        </section>

        <section>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1A1A1A] mb-2">
            Как это работает
          </h2>
          <p className="text-[#6B7280] mb-8 max-w-2xl leading-relaxed">
            Короткий путь от регистрации до приглашения — без лишних этапов и скрытых контактов.
          </p>
          <ol className="grid sm:grid-cols-2 gap-5 md:gap-6">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-[28px] bg-[#F3F3F3] p-6 md:p-8"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#8B7CF6] text-white text-sm font-bold mb-4">
                  {index + 1}
                </span>
                <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">{step.title}</h3>
                <p className="text-[#6B7280] leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-[#1A1A1A] rounded-[40px] p-8 md:p-12 flex flex-col md:flex-row md:items-center gap-8 justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
              Готовы проверить навыки или найти специалиста?
            </h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              Зарегистрируйтесь и начните с опроса или сразу откройте подборку по категории.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/register?role=candidate"
              className="bg-[#8B7CF6] hover:bg-[#7A6BE5] text-white px-7 py-3 rounded-full text-sm font-medium transition-colors"
            >
              Я кандидат
            </Link>
            <Link
              href="/register?role=employer"
              className="bg-white hover:bg-[#F3F4F6] text-[#1A1A1A] px-7 py-3 rounded-full text-sm font-medium transition-colors"
            >
              Я работодатель
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
