# Безопасность ПДн (минимум 152-ФЗ)

Правовой минимум по ТЗ / Q&A: согласие на обработку, контроль видимости контактов и профиля.

## Что реализовано

1. **Согласие при регистрации** — без `consent_152fz=true` аккаунт не создаётся.
2. **Фиксация времени согласия** — `consent_152fz_at`.
3. **Отзыв согласия** — в профиле кандидата: снимает публикацию (`privacy_public=false`), убирает из подборки.
4. **Подборка только с согласием** — match фильтрует `consent_152fz=true` + `privacy_public=true`.
5. **Профиль скрыт по умолчанию** — при регистрации `privacy_public=false`; публикация только явным opt-in в настройках.
6. **Контакты скрыты** до `accepted`; после accept открываются только пригласившему.
   Маски в API: `phone_display` / `email_display` / `telegram_display`; в тексте резюме/about
   email/телефон/telegram маскируются (`redact_pii`), пока контакты не раскрыты.
   Работодатель может изучать карточку и файл резюме (`GET /employer/candidates/{id}`).
7. **Отзыв доступа к контактам** — `PATCH /api/candidate/invitations/{id}/contacts` (`revoke: true`).
8. **Пароли** — bcrypt, сложность ≥8 + буква + цифра; в API не отдаются.
9. **Confirm email** — в БД только SHA-256 hash токена + TTL; plaintext только при локальном `EXPOSE_EMAIL_CONFIRM_TOKEN`.
10. **Заголовки** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store`.
11. **Несовершеннолетние 16–17** — `birth_date` + `parental_consent` (см. `minor_consent.py`).
12. **Песочница кода** — без произвольного RCE: AST allowlist, restricted builtins, `python -I`, rate limit.
13. **Антислив теста** — только группа A или B целиком; прокторинг-флаг отменяет присвоение категории.

## Прод-чеклист

- `DEBUG=false`
- уникальный `SECRET_KEY` (≥32)
- `EXPOSE_EMAIL_CONFIRM_TOKEN=false`
- `ALLOW_DEMO_SEED=false`
- явный `CORS_ORIGINS`, без `CORS_ORIGIN_REGEX`

## Не делаем на MVP (плюс / после)

- Keycloak / боевой FSP ID
- Полный export/delete аккаунта как отдельный GDPR-флоу
- Контейнерная изоляция sandbox (nsjail/gVisor) вместо AST-ограничений
