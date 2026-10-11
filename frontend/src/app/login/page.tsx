import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F9F9] px-4 py-12">
      {/* Карточка формы — ограничена по ширине и центрирована */}
      <div className="w-full max-w-[450px] bg-[#F3F3F3] rounded-[40px] p-8 md:p-10 flex flex-col items-center shadow-sm">

        {/* Заголовок */}
        <h1 className="text-2xl md:text-3xl font-semibold text-[#1A1A1A] mb-8 tracking-wide">
          АВТОРИЗАЦИЯ
        </h1>

        {/* Форма */}
        <form className="w-full flex flex-col gap-4">

          {/* Поле Email */}
          <div className="w-full">
            <input
              type="email"
              defaultValue="candidate@demo.ru"
              placeholder="Email"
              className="w-full bg-[#D9D9D9] text-[#1A1A1A] placeholder-[#6B7280] px-6 py-4 rounded-full text-base outline-none focus:ring-2 focus:ring-[#8B7CF6] transition-all"
            />
          </div>

          {/* Поле Пароль */}
          <div className="w-full">
            <input
              type="password"
              defaultValue="demo1234"
              placeholder="Пароль"
              className="w-full bg-[#D9D9D9] text-[#1A1A1A] placeholder-[#6B7280] px-6 py-4 rounded-full text-base outline-none focus:ring-2 focus:ring-[#8B7CF6] transition-all"
            />
          </div>

          {/* Чекбокс и ссылка "Забыли пароль" */}
          <div className="flex items-center justify-between w-full px-1 mt-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-2 border-gray-500 text-[#8B7CF6] focus:ring-[#8B7CF6] cursor-pointer accent-[#8B7CF6]"
              />
              <span className="text-sm text-[#1A1A1A] font-medium group-hover:text-[#8B7CF6] transition-colors">
                Запомнить меня
              </span>
            </label>
            
            <Link 
              href="/forgot-password" 
              className="text-sm text-[#1A1A1A] font-medium hover:text-[#8B7CF6] transition-colors"
            >
              Забыли пароль?
            </Link>
          </div>

          {/* Кнопка Войти */}
          <button
            type="submit"
            className="w-full bg-[#8B7CF6] hover:bg-[#7A6BE5] text-white py-4 rounded-full text-base font-semibold tracking-wider transition-colors mt-2"
          >
            ВОЙТИ
          </button>
        </form>

        {/* Ссылка "Нет аккаунта?" */}
        <div className="mt-6 text-sm text-[#1A1A1A] font-medium">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-[#8B7CF6] hover:underline">
            Зарегистрироваться
          </Link>
        </div>

      </div>
    </div>
  );
}