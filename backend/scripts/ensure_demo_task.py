"""Создаёт/обновляет демо-задания с кодом для employer@demo.ru (по title)."""

from app.database import SessionLocal
from app.models import Employer, EmployerTask, EmployerTaskType, User

# Самодостаточные задачи: автопроверка сравнивает stdout без stdin.
CODE_TASKS = [
    {
        "title": "Разогрев: print hello",
        "prompt": "Выведите в stdout ровно одну строку: hello\n\nПример решения:\nprint('hello')",
        "expected_stdout": "hello",
    },
    {
        "title": "Сумма двух чисел",
        "prompt": "Вычислите 17 + 25 и выведите результат одним числом.",
        "expected_stdout": "42",
    },
    {
        "title": "Факториал 5",
        "prompt": "Вычислите 5! (факториал) и выведите результат одним числом.",
        "expected_stdout": "120",
    },
    {
        "title": "FizzBuzz до 15",
        "prompt": (
            "Для чисел от 1 до 15 включительно выведите каждое на новой строке:\n"
            "кратно 3 и 5 → FizzBuzz, только 3 → Fizz, только 5 → Buzz, иначе число."
        ),
        "expected_stdout": (
            "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz"
        ),
    },
    {
        "title": "Реверс строки",
        "prompt": "Возьмите строку 'python' и выведите её в обратном порядке.",
        "expected_stdout": "nohtyp",
    },
    {
        "title": "Максимум в списке",
        "prompt": "Для списка [3, 9, 2, 7, 9, 1] выведите максимальный элемент.",
        "expected_stdout": "9",
    },
    {
        "title": "Палиндром",
        "prompt": (
            "Проверьте, является ли строка 'Level' палиндромом (без учёта регистра).\n"
            "Выведите YES или NO."
        ),
        "expected_stdout": "YES",
    },
    {
        "title": "Сумма цифр числа",
        "prompt": "Для числа 2026 выведите сумму его цифр.",
        "expected_stdout": "10",
    },
    {
        "title": "Чётные числа 1..10",
        "prompt": "Выведите чётные числа от 1 до 10 включительно, через пробел.",
        "expected_stdout": "2 4 6 8 10",
    },
    {
        "title": "Сортировка чисел",
        "prompt": (
            "Отсортируйте список [5, 1, 9, 2, 7] по возрастанию и выведите через пробел."
        ),
        "expected_stdout": "1 2 5 7 9",
    },
    {
        "title": "Подсчёт гласных",
        "prompt": (
            "В строке 'Beautiful' посчитайте гласные буквы aeiou (регистр не важен) "
            "и выведите число."
        ),
        "expected_stdout": "5",
    },
    {
        "title": "Таблица умножения на 3",
        "prompt": (
            "Выведите строки вида «3 x i = результат» для i от 1 до 5 включительно."
        ),
        "expected_stdout": "3 x 1 = 3\n3 x 2 = 6\n3 x 3 = 9\n3 x 4 = 12\n3 x 5 = 15",
    },
    {
        "title": "Уникальные элементы",
        "prompt": (
            "Из списка [1, 2, 2, 3, 1, 4] выведите уникальные значения в порядке "
            "первого появления, через пробел."
        ),
        "expected_stdout": "1 2 3 4",
    },
    {
        "title": "Среднее арифметическое",
        "prompt": (
            "Для чисел 2, 4, 6 вычислите среднее арифметическое и выведите "
            "с одним знаком после точки (например 4.0)."
        ),
        "expected_stdout": "4.0",
    },
    {
        "title": "Степень двойки",
        "prompt": "Вычислите 2**10 и выведите результат одним числом.",
        "expected_stdout": "1024",
    },
]


def main() -> None:
    db = SessionLocal()
    try:
        emp = db.query(Employer).join(User).filter(User.email == "employer@demo.ru").first()
        if not emp:
            raise SystemExit("employer@demo.ru not found — сначала запустите seed.py")

        by_title = {
            t.title: t
            for t in db.query(EmployerTask).filter(EmployerTask.employer_id == emp.id).all()
        }
        added = 0
        updated = 0
        for item in CODE_TASKS:
            existing = by_title.get(item["title"])
            if existing:
                existing.task_type = EmployerTaskType.CODE
                existing.prompt = item["prompt"]
                existing.expected_stdout = item["expected_stdout"]
                updated += 1
                continue
            db.add(
                EmployerTask(
                    employer_id=emp.id,
                    title=item["title"],
                    task_type=EmployerTaskType.CODE,
                    prompt=item["prompt"],
                    expected_stdout=item["expected_stdout"],
                )
            )
            added += 1

        db.commit()
        total = (
            db.query(EmployerTask)
            .filter(
                EmployerTask.employer_id == emp.id,
                EmployerTask.task_type == EmployerTaskType.CODE,
            )
            .count()
        )
        print(f"added={added}, updated={updated}, code_tasks={total}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
