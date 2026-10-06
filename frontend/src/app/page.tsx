import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
      <p className="badge w-fit">ФСП спец. трек · MVP</p>
      <h1
        className="mt-4 text-4xl font-bold tracking-tight md:text-5xl"
        style={{ fontFamily: "var(--font-sora), sans-serif" }}
      >
        FSP Match
      </h1>
      <p className="muted mt-4 max-w-2xl text-lg leading-relaxed">
        Работодатель находит категорию и приглашает кандидата. Категория — только после опроса и
        теста, не по самоописанию резюме.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/login" className="btn btn-primary">
          Войти
        </Link>
        <Link href="/register" className="btn btn-ghost">
          Регистрация
        </Link>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-2">
        <Link href="/candidate" className="panel transition hover:border-[var(--brand)]">
          <h2 className="text-xl font-bold">Кабинет кандидата</h2>
          <p className="muted mt-2 text-sm">
            Профиль → опрос → тест → категория → входящие приглашения
          </p>
        </Link>
        <Link href="/employer" className="panel transition hover:border-[var(--brand)]">
          <h2 className="text-xl font-bold">Кабинет работодателя</h2>
          <p className="muted mt-2 text-sm">
            Компания → потребность → подборка → приглашение с зарплатой
          </p>
        </Link>
      </div>

      <div className="panel mt-8 text-sm">
        <p className="font-semibold">Демо-аккаунты</p>
        <ul className="muted mt-2 space-y-1">
          <li>candidate@demo.ru / demo1234 — Backend Middle + ФСП</li>
          <li>new@demo.ru / demo1234 — пустой профиль (полный флоу теста)</li>
          <li>employer@demo.ru / demo1234 — работодатель</li>
        </ul>
      </div>
    </main>
  );
}
