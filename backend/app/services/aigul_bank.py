"""Банки заданий хакатона: задания и ответы в разных SQL-файлах (Айгуль, Луиза, …)."""

from __future__ import annotations

import json
import re
from pathlib import Path

SQL_DIR = Path(__file__).resolve().parents[2] / "sql"

# Пары: (файл заданий, файл ответов) — ответы никогда не смешиваются с публичным текстом
BANK_SOURCES: list[tuple[str, str]] = [
    ("aigul_84_TASKS_ONLY.sql", "aigul_84_ANSWERS_ONLY.sql"),
    ("louisa_TASKS_ONLY.sql", "louisa_ANSWERS_ONLY.sql"),
]

SPEC_MAP = {
    "Backend": "backend",
    "Data": "data",
    "QA": "qa",
    "Mobile": "mobile",
    "Frontend": "frontend",
    "Fullstack": "fullstack",
    "DevOps": "devops",
}
GRADE_MAP = {
    "Junior": "junior",
    "Middle": "middle",
    "Senior": "senior",
}
DIFFICULTY = {"junior": 1, "middle": 2, "senior": 3}

THEORY_TYPES = {"Теория"}
# Открытые текстовые задания, которые тоже идут в бланк теста (как MCQ)
OPEN_TEXT_TYPES = {"Теория", "Анализ", "Анализ кода/ситуации"}
PRACTICE_TYPES = {"Практика", "Практика (код)"}
_OPTION_MAX_LEN = 280


def _split_sql_values(payload: str) -> list[str | None]:
    """Разбор списка значений SQL с учётом кавычек и переносов строк."""
    values: list[str | None] = []
    i = 0
    n = len(payload)
    while i < n:
        while i < n and payload[i] in " \t\r\n,":
            i += 1
        if i >= n:
            break
        if payload.startswith("NULL", i) and (i + 4 >= n or payload[i + 4] in ", \t\r\n)"):
            values.append(None)
            i += 4
            continue
        if payload[i] == "'":
            i += 1
            buf: list[str] = []
            while i < n:
                ch = payload[i]
                if ch == "'" and i + 1 < n and payload[i + 1] == "'":
                    buf.append("'")
                    i += 2
                    continue
                if ch == "'":
                    i += 1
                    break
                buf.append(ch)
                i += 1
            values.append("".join(buf))
            continue
        j = i
        while j < n and payload[j] not in ",)":
            j += 1
        token = payload[i:j].strip()
        values.append(token or None)
        i = j
    return values


def _parse_inserts(sql_text: str, table: str) -> list[list[str | None]]:
    rows: list[list[str | None]] = []
    marker = f"INSERT INTO {table}"
    pos = 0
    while True:
        start = sql_text.find(marker, pos)
        if start < 0:
            break
        values_at = sql_text.find("VALUES", start)
        if values_at < 0:
            break
        open_paren = sql_text.find("(", values_at)
        if open_paren < 0:
            break
        depth = 0
        i = open_paren
        in_str = False
        while i < len(sql_text):
            ch = sql_text[i]
            if in_str:
                if ch == "'" and i + 1 < len(sql_text) and sql_text[i + 1] == "'":
                    i += 2
                    continue
                if ch == "'":
                    in_str = False
                i += 1
                continue
            if ch == "'":
                in_str = True
                i += 1
                continue
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    payload = sql_text[open_paren + 1 : i]
                    payload = re.sub(r"'::jsonb", "'", payload)
                    rows.append(_split_sql_values(payload))
                    pos = i + 1
                    break
            i += 1
        else:
            break
    return rows


def _rows_to_tasks(rows: list[list[str | None]]) -> list[dict]:
    out: list[dict] = []
    for r in rows:
        if len(r) < 10:
            continue
        options_raw = r[8]
        options = None
        if options_raw:
            try:
                parsed = json.loads(options_raw)
                options = parsed if isinstance(parsed, list) and parsed else None
            except json.JSONDecodeError:
                options = None
        out.append(
            {
                "id": r[0],
                "specialization": r[1],
                "grade": r[2],
                "type": r[3],
                "title": r[4],
                "prompt": r[5],
                "language": r[6],
                "starter_code": r[7],
                "options": options,
                "example": r[9],
            }
        )
    return out


def _rows_to_answers(rows: list[list[str | None]]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for r in rows:
        if len(r) < 6 or not r[0]:
            continue
        out[r[0]] = {
            "task_id": r[0],
            "answer": r[1],
            "explanation": r[2],
            "reference_solution": r[3],
            "criteria": r[4],
            "max_score": int(r[5]) if r[5] is not None else 0,
        }
    return out


def load_tasks() -> list[dict]:
    """Все задания из всех банков (по id последний источник побеждает)."""
    by_id: dict[str, dict] = {}
    for tasks_name, _ in BANK_SOURCES:
        path = SQL_DIR / tasks_name
        if not path.is_file():
            continue
        for t in _rows_to_tasks(_parse_inserts(path.read_text(encoding="utf-8"), "hackathon_tasks_public")):
            if t["id"]:
                by_id[t["id"]] = t
    return list(by_id.values())


def load_answers() -> dict[str, dict]:
    """Все ключи ответов из всех банков."""
    out: dict[str, dict] = {}
    for _, answers_name in BANK_SOURCES:
        path = SQL_DIR / answers_name
        if not path.is_file():
            continue
        out.update(_rows_to_answers(_parse_inserts(path.read_text(encoding="utf-8"), "hackathon_task_answer_keys")))
    return out


def _clip_option(text: str) -> str:
    text = " ".join((text or "").split())
    if len(text) <= _OPTION_MAX_LEN:
        return text
    return text[: _OPTION_MAX_LEN - 1].rstrip() + "…"


def _variant_for_id(task_id: str) -> str:
    m = re.search(r"(\d+)$", task_id or "0")
    num = int(m.group(1)) if m else 0
    return "A" if num % 2 == 1 else "B"


def _mcq_from_open_answer(
    correct: str,
    distractor_pool: list[str],
    *,
    seed: str,
) -> tuple[list[str], int] | None:
    """Собрать 4 варианта: эталонный ответ + чужие ответы того же банка."""
    correct_opt = _clip_option(correct)
    if not correct_opt:
        return None

    distractors: list[str] = []
    seen = {correct_opt.casefold()}
    # Стабильный порядок от id, чтобы бланки не «прыгали» при каждом импорте
    pool = sorted({_clip_option(x) for x in distractor_pool if x}, key=lambda s: (len(s), s))
    rotate = sum(ord(ch) for ch in seed) % (len(pool) or 1)
    if pool:
        pool = pool[rotate:] + pool[:rotate]
    for d in pool:
        key = d.casefold()
        if key in seen:
            continue
        distractors.append(d)
        seen.add(key)
        if len(distractors) >= 3:
            break

    # Если чужих ответов мало — добираем явными «неверными» формулировками
    fillers = [
        "Это не влияет на поведение системы и может быть проигнорировано.",
        "Достаточно проверить только на клиенте; серверная сторона не нужна.",
        "Правильный подход — хардкод значений без валидации и обработки ошибок.",
        "Ответ сводится к копированию кода без понимания ограничений.",
    ]
    for f in fillers:
        if len(distractors) >= 3:
            break
        if f.casefold() not in seen:
            distractors.append(f)
            seen.add(f.casefold())

    if len(distractors) < 3:
        return None

    options = [correct_opt, *distractors[:3]]
    # Перемешиваем стабильно по seed, сохраняя correct_index
    order = list(range(4))
    order_seed = sum(ord(ch) for ch in (seed + ":opts")) % 24
    for i in range(3, 0, -1):
        j = order_seed % (i + 1)
        order_seed //= i + 1
        order[i], order[j] = order[j], order[i]
    shuffled = [options[i] for i in order]
    correct_index = shuffled.index(correct_opt)
    return shuffled, correct_index


def theory_questions_by_category() -> dict[tuple[str, str], list[dict]]:
    """
    Вопросы для бланков теста из всех банков (Айгуль + Луиза).

    - MCQ с готовыми options — как есть (Айгуль).
    - Открытые «Теория»/«Анализ» (Луиза и кейсы Айгуль) — собираем MCQ
      из эталонного ответа + дистракторов из соседних ключей.
    """
    tasks = load_tasks()
    answers = load_answers()
    bank: dict[tuple[str, str], list[dict]] = {}

    # Пул текстов ответов по категории — для дистракторов открытых вопросов
    open_answer_pool: dict[tuple[str, str], list[str]] = {}
    for task in tasks:
        if task["type"] not in OPEN_TEXT_TYPES:
            continue
        spec = SPEC_MAP.get(task["specialization"] or "")
        grade = GRADE_MAP.get(task["grade"] or "")
        if not spec or not grade:
            continue
        key_ans = answers.get(task["id"] or "")
        text = (key_ans or {}).get("answer")
        if text:
            open_answer_pool.setdefault((spec, grade), []).append(text)

    for task in tasks:
        spec = SPEC_MAP.get(task["specialization"] or "")
        grade = GRADE_MAP.get(task["grade"] or "")
        if not spec or not grade:
            continue

        key_ans = answers.get(task["id"] or "")
        if not key_ans or not key_ans.get("answer"):
            continue

        options: list[str] | None = None
        correct_index: int | None = None

        if task["type"] in THEORY_TYPES and task["options"]:
            options = list(task["options"])
            try:
                correct_index = options.index(key_ans["answer"])
            except ValueError:
                correct_index = next(
                    (i for i, o in enumerate(options) if o == key_ans["answer"] or key_ans["answer"] in o),
                    None,
                )
        elif task["type"] in OPEN_TEXT_TYPES and not task["options"]:
            pool = [a for a in open_answer_pool.get((spec, grade), []) if a != key_ans["answer"]]
            built = _mcq_from_open_answer(key_ans["answer"], pool, seed=task["id"] or "")
            if built:
                options, correct_index = built

        if not options or correct_index is None:
            continue

        q = {
            "external_id": task["id"],
            "variant_group": _variant_for_id(task["id"] or ""),
            "topic": task["title"] or task["type"] or "Теория",
            "text": task["prompt"],
            "options": options,
            "correct_index": correct_index,
            "difficulty": DIFFICULTY[grade],
        }
        bank.setdefault((spec, grade), []).append(q)

    return bank


def practice_tasks() -> list[dict]:
    tasks = load_tasks()
    answers = load_answers()
    out: list[dict] = []
    for task in tasks:
        if task["type"] not in PRACTICE_TYPES:
            continue
        ans = answers.get(task["id"] or "", {})
        out.append({**task, "answer_key": ans})
    return out


def upsert_raw_tables(db) -> tuple[int, int]:
    """Записать задания и ответы в раздельные таблицы ORM (все банки)."""
    from app.models import HackathonAnswerKey, HackathonTask

    tasks = load_tasks()
    answers = load_answers()

    for t in tasks:
        row = db.get(HackathonTask, t["id"])
        payload = dict(
            specialization=t["specialization"],
            grade=t["grade"],
            type=t["type"],
            title=t["title"],
            prompt=t["prompt"] or "",
            language=t["language"],
            starter_code=t["starter_code"],
            options_json=json.dumps(t["options"], ensure_ascii=False) if t["options"] else None,
            example=t["example"],
        )
        if row:
            for k, v in payload.items():
                setattr(row, k, v)
        else:
            db.add(HackathonTask(id=t["id"], **payload))

    db.flush()

    for tid, a in answers.items():
        row = db.get(HackathonAnswerKey, tid)
        payload = dict(
            answer=a.get("answer"),
            explanation=a.get("explanation"),
            reference_solution=a.get("reference_solution"),
            criteria=a.get("criteria"),
            max_score=a.get("max_score") or 1,
        )
        if row:
            for k, v in payload.items():
                setattr(row, k, v)
        else:
            db.add(HackathonAnswerKey(task_id=tid, **payload))

    return len(tasks), len(answers)
