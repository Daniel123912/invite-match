# Дополнительный функционал (плюс к MVP)

| Фича | Реализация |
|------|------------|
| Песочница кода | `POST /api/candidate/sandbox/run`, UI `/candidate/sandbox` |
| Прокторинг | blur/paste/visibility → `POST /api/candidate/test/{id}/proctor` |
| Антиплагиат | сравнение ответов в variant_group при submit |
| Задания работодателя | `/api/employer/tasks`, назначение при приглашении |
| Чат | `/api/chat/{invitation_id}` |
| Уведомления чата | `GET /api/chat/inbox`, `POST /api/chat/{id}/read`, колокольчик в кабинете |
| Отзыв контактов | `PATCH /api/candidate/invitations/{id}/contacts` |
| 16–17 лет | `birth_date`, `parental_consent` при регистрации/профиле |
| Несколько спец. | `specializations` в опросе, JSON в БД |
| Антификтивные вакансии | описание ≥20 символов, жалобы, `is_suspicious` |
| ATS (концепт) | `/api/employer/ats/export`, `/api/employer/ats/webhook` |
