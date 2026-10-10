"""Грейд из категории теста, кулдаун, приватность приглашений, отзыв согласия."""

from datetime import datetime, timedelta, timezone

from app.models import Candidate, GradeLevel, TestAttempt, User


def _login(client, email: str, password: str = "demo1234") -> dict:
    r = client.post("/api/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_submit_confirms_grade_from_attempt_category(client, db):
    """Смена опроса после старта не меняет грейд результата."""
    user = db.query(User).filter(User.email == "new@demo.ru").first()
    cand = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    cand.consent_152fz = True
    cand.confirmed_grade = None
    cand.selected_grade = GradeLevel.JUNIOR
    cand.last_grade_change_at = None
    db.query(TestAttempt).filter(TestAttempt.candidate_id == cand.id).delete()
    db.commit()

    h = _login(client, "new@demo.ru")
    client.post(
        "/api/candidate/survey",
        headers=h,
        json={
            "industry": "it",
            "specialization": "backend",
            "selected_grade": "junior",
        },
    )
    start = client.post("/api/candidate/test/start", headers=h)
    assert start.status_code == 200, start.text
    attempt_id = start.json()["attempt_id"]
    questions = start.json()["questions"]

    # Меняем опрос на senior — попытка junior уже идёт
    client.post(
        "/api/candidate/survey",
        headers=h,
        json={
            "industry": "it",
            "specialization": "backend",
            "selected_grade": "senior",
        },
    )

    # После смены опроса незавершённая попытка аннулируется — сдаём новую junior?
    # Стартуем заново junior (после смены на senior кулдаун не мешает — confirmed ещё нет)
    # Вернём junior и стартуем снова
    client.post(
        "/api/candidate/survey",
        headers=h,
        json={
            "industry": "it",
            "specialization": "backend",
            "selected_grade": "junior",
        },
    )
    start2 = client.post("/api/candidate/test/start", headers=h)
    assert start2.status_code == 200, start2.text
    attempt_id = start2.json()["attempt_id"]
    questions = start2.json()["questions"]

    # Подглядываем правильные ответы из БД
    from app.models import TestQuestion

    q_ids = [q["id"] for q in questions]
    by_id = {q.id: q for q in db.query(TestQuestion).filter(TestQuestion.id.in_(q_ids)).all()}
    answers = {str(qid): by_id[qid].correct_index for qid in q_ids}

    # Меняем selected на senior прямо перед submit (через ORM — опрос уже junior)
    cand = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    cand.selected_grade = GradeLevel.SENIOR
    db.commit()

    sub = client.post(
        "/api/candidate/test/submit",
        headers=h,
        json={"attempt_id": attempt_id, "answers": {int(k): v for k, v in answers.items()}},
    )
    assert sub.status_code == 200, sub.text
    assert sub.json()["passed"] is True
    assert sub.json()["confirmed_grade"] == "junior"

    db.refresh(cand)
    assert cand.confirmed_grade == GradeLevel.JUNIOR


def test_second_start_abandons_previous(client, db):
    h = _login(client, "new@demo.ru")
    client.post(
        "/api/candidate/survey",
        headers=h,
        json={"industry": "it", "specialization": "backend", "selected_grade": "middle"},
    )
    a1 = client.post("/api/candidate/test/start", headers=h)
    assert a1.status_code == 200
    id1 = a1.json()["attempt_id"]
    a2 = client.post("/api/candidate/test/start", headers=h)
    assert a2.status_code == 200
    id2 = a2.json()["attempt_id"]
    assert id1 != id2

    old = db.query(TestAttempt).filter(TestAttempt.id == id1).first()
    assert old.finished_at is not None
    assert old.passed is False


def test_cannot_invite_hidden_candidate(client, db):
    cand = (
        db.query(Candidate)
        .join(User)
        .filter(User.email == "candidate@demo.ru")
        .first()
    )
    cand.privacy_public = False
    db.commit()
    try:
        eh = _login(client, "employer@demo.ru")
        inv = client.post(
            "/api/employer/invitations",
            headers=eh,
            json={
                "candidate_id": cand.id,
                "message": "Приглашение скрытому кандидату — должно быть отклонено.",
                "salary_from": 180000,
                "salary_to": 250000,
            },
        )
        assert inv.status_code == 403
    finally:
        cand.privacy_public = True
        db.commit()


def test_consent_revoke_full_profile_ok(client):
    h = _login(client, "candidate@demo.ru")
    r = client.patch(
        "/api/candidate/profile",
        headers=h,
        json={
            "full_name": "Иван Кандидат",
            "phone": "+79001112233",
            "telegram": "@demo_cand",
            "city": "Москва",
            "about": "тест",
            "resume_text": "резюме",
            "stack": "Python",
            "privacy_public": False,
            "consent_152fz": False,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["consent_152fz"] is False
    assert r.json()["privacy_public"] is False

    # вернём согласие для остальных тестов
    r2 = client.patch(
        "/api/candidate/profile",
        headers=h,
        json={"consent_152fz": True, "privacy_public": True},
    )
    assert r2.status_code == 200


def test_match_by_need_id(client, db):
    from app.models import Employer, EmployerNeed

    eh = _login(client, "employer@demo.ru")
    emp = db.query(Employer).join(User).filter(User.email == "employer@demo.ru").first()
    need = db.query(EmployerNeed).filter(EmployerNeed.employer_id == emp.id).first()
    assert need

    m = client.get(
        "/api/employer/match",
        headers=eh,
        params={"need_id": need.id},
    )
    assert m.status_code == 200, m.text
    assert m.json()["category"]["specialization"] == need.specialization.value
    assert m.json()["category"]["grade"] == need.grade.value


def test_grade_cooldown_blocks_survey_change(client, db):
    user = db.query(User).filter(User.email == "candidate@demo.ru").first()
    cand = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    cand.confirmed_grade = GradeLevel.MIDDLE
    cand.selected_grade = GradeLevel.MIDDLE
    cand.last_grade_change_at = datetime.now(timezone.utc) - timedelta(days=1)
    db.commit()

    h = _login(client, "candidate@demo.ru")
    r = client.post(
        "/api/candidate/survey",
        headers=h,
        json={
            "industry": "it",
            "specialization": "backend",
            "selected_grade": "senior",
        },
    )
    assert r.status_code == 400
    assert "Смена грейда" in r.json()["detail"]
