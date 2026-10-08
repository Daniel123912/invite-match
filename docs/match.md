# Подбор, категоризация и приглашения

## Категоризация

**Категория** = `Specialization` × `GradeLevel` (например Backend × Middle).  
Попадание в категорию для работодателя:

- **Подтверждённо:** успешный тест (≥60%) на выбранный грейд → `category_id` и `confirmed_grade`.
- **Неподтверждённо:** тот же `specialization` и `selected_grade`, есть `test_score`, но грейд не подтверждён в этой категории — кандидат **виден**, но ниже в выдаче.

В подборку попадают только профили с `privacy_public=true` и `consent_152fz=true`.

## Ранжирование (объяснимый подбор)

Базовая формула:

```
rank = test_score × 0.7 + min(fsp_score, 100) × 0.3
```

- `test_score` — результат последней попытки (0–100).
- `fsp_score` — сумма баллов из заглушки достижений ФСП; если истории нет (`has_fsp_history=false`), вклад ФСП = 0, в `reason` явно указано.

Для **неподтверждённого** грейда: `rank × 0.55` (константа `UNCONFIRMED_RANK_FACTOR`).

Поле **`reason`** (строка для UI и приглашения): тест %, ФСП или отсутствие истории, стек, пометка о неподтверждённом грейде.

Сортировка: сначала подтверждённые, затем по убыванию `rank_score`.

## Поиск и фильтры

`GET /api/employer/match`:

| Параметр | Назначение |
|----------|------------|
| `specialization` | backend, frontend, … |
| `grade` | junior, middle, senior |
| `stack` | подстрока по полю `stack` (через запятую — любое совпадение) |
| `fsp_only` | true/false — только с историей ФСП / только без |

`GET /api/employer/categories` — обзор категорий и числа кандидатов в БД (все с `category_id`).

## Адресное приглашение

`POST /api/employer/invitations`:

- Обязательны `message`, `salary_from`, `salary_to` (₽, тип gross/net указывается в тексте оффера).
- `reason` копируется из актуального обоснования подбора.
- Статусы: `sent` → `viewed` (при открытии кандидатом) → `accepted` | `declined`.

**Контакты** (email, phone, telegram) отдаются работодателю только при `accepted` и если кандидат не отозвал доступ (`contacts_revoked`).

Кандидат: `PATCH /api/invitations/{id}`, отзыв: `PATCH /api/candidate/invitations/{id}/contacts`.

## Код

- `backend/app/services/match_service.py`
- `backend/app/api/routes/employer.py`, `invitations.py`
