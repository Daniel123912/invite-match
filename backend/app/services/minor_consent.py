from datetime import date, datetime

from fastapi import HTTPException


def parse_birth_date(value: date | datetime | str | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def require_parental_consent_if_minor(birth: date | None, parental_consent: bool) -> None:
    if not birth:
        return
    today = date.today()
    age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    if age < 16:
        raise HTTPException(400, "Регистрация доступна с 16 лет")
    if 16 <= age < 18 and not parental_consent:
        raise HTTPException(
            400,
            "Для пользователей 16–17 лет требуется согласие родителей на обработку ПДн",
        )
