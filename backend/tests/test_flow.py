"""Сквозной API-флоу: survey → test → match → invite → accept → revoke."""


def _login(client, email: str, password: str = "demo1234") -> dict:
    r = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_fsp_stub(client):
    r = client.get("/api/fsp/FSP-1001/achievements")
    assert r.status_code == 200
    body = r.json()
    assert body["has_history"] is True
    assert body["total_points"] > 0

    empty = client.get("/api/fsp/UNKNOWN-ID/achievements")
    assert empty.status_code == 200
    assert empty.json()["has_history"] is False


def test_invite_accept_revoke_contacts(client):
    eh = _login(client, "employer@demo.ru")
    m = client.get(
        "/api/employer/match",
        headers=eh,
        params={"specialization": "backend", "grade": "middle"},
    )
    assert m.status_code == 200
    cands = m.json()["candidates"]
    assert cands
    cand_id = cands[0]["id"]
    assert "phone" not in cands[0]

    inv = client.post(
        "/api/employer/invitations",
        headers=eh,
        json={
            "candidate_id": cand_id,
            "message": "Тест приглашение",
            "salary_from": 180000,
            "salary_to": 250000,
        },
    )
    assert inv.status_code == 201
    inv_id = inv.json()["id"]
    assert inv.json().get("candidate_phone") is None

    # найти email кандидата через seed-аккаунт candidate@demo.ru если id=1 иначе через match name
    # Для стабильности логинимся как candidate@demo.ru и ищем своё приглашение
    ch = _login(client, "candidate@demo.ru")
    incoming = client.get("/api/invitations/incoming", headers=ch)
    assert incoming.status_code == 200
    mine = [i for i in incoming.json() if i["id"] == inv_id]
    if not mine:
        # пригласили не candidate@demo.ru — принимаем тем, кого пригласили, через повторный match top
        # упрощение: создаём приглашение именно candidate@demo.ru
        from app.database import SessionLocal
        from app.models import Candidate, User

        db = SessionLocal()
        cand = (
            db.query(Candidate)
            .join(User)
            .filter(User.email == "candidate@demo.ru")
            .first()
        )
        db.close()
        inv = client.post(
            "/api/employer/invitations",
            headers=eh,
            json={
                "candidate_id": cand.id,
                "message": "Тест приглашение 2",
                "salary_from": 180000,
                "salary_to": 250000,
            },
        )
        inv_id = inv.json()["id"]
        incoming = client.get("/api/invitations/incoming", headers=ch)
        mine = [i for i in incoming.json() if i["id"] == inv_id]

    assert mine
    acc = client.patch(
        f"/api/invitations/{inv_id}",
        headers=ch,
        json={"status": "accepted"},
    )
    assert acc.status_code == 200

    out = client.get("/api/employer/invitations", headers=eh)
    row = next(i for i in out.json() if i["id"] == inv_id)
    assert row.get("candidate_email") or row.get("candidate_phone")

    rev = client.patch(
        f"/api/candidate/invitations/{inv_id}/contacts",
        headers=ch,
        json={"revoke": True},
    )
    assert rev.status_code == 200

    out2 = client.get("/api/employer/invitations", headers=eh)
    row2 = next(i for i in out2.json() if i["id"] == inv_id)
    assert row2.get("candidate_phone") is None
    assert row2.get("candidate_email") is None
