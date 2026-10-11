"""Проверки регистрации, check-email и подтверждения email."""


def test_check_email_available(client):
    r = client.get("/api/auth/check-email", params={"email": "free_user@example.com"})
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True


def test_check_email_taken(client):
    r = client.get("/api/auth/check-email", params={"email": "candidate@demo.ru"})
    assert r.status_code == 200
    assert r.json()["available"] is False


def test_register_without_consent(client):
    r = client.post(
        "/api/auth/register",
        json={
            "email": "noconsent@example.com",
            "password": "demo1234",
            "role": "candidate",
            "full_name": "Test User",
            "consent_152fz": False,
        },
    )
    assert r.status_code == 400
    assert "152" in r.json()["detail"]


def test_register_weak_password(client):
    r = client.post(
        "/api/auth/register",
        json={
            "email": "weak@example.com",
            "password": "short",
            "role": "candidate",
            "full_name": "Test User",
            "consent_152fz": True,
        },
    )
    assert r.status_code == 422


def test_register_duplicate_email(client):
    r = client.post(
        "/api/auth/register",
        json={
            "email": "candidate@demo.ru",
            "password": "demo1234",
            "role": "candidate",
            "full_name": "Dup",
            "consent_152fz": True,
        },
    )
    assert r.status_code == 400


def test_register_confirm_and_me(client):
    r = client.post(
        "/api/auth/register",
        json={
            "email": "ok_reg@example.com",
            "password": "demo1234",
            "role": "candidate",
            "full_name": "Ок Рег",
            "consent_152fz": True,
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == "ok_reg@example.com"
    token = body["email_confirm_token"]
    assert token

    login_blocked = client.post(
        "/api/auth/login",
        data={"username": "ok_reg@example.com", "password": "demo1234"},
    )
    assert login_blocked.status_code == 403

    conf = client.post("/api/auth/confirm-email", json={"token": token})
    assert conf.status_code == 200, conf.text
    access = conf.json()["access_token"]
    assert conf.json()["email_verified"] is True

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 200
    assert me.json()["email"] == "ok_reg@example.com"
    assert me.json()["email_verified"] is True

    profile = client.get(
        "/api/candidate/profile",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert profile.status_code == 200
    assert profile.json()["consent_152fz"] is True


def test_login_demo_verified(client):
    r = client.post(
        "/api/auth/login",
        data={"username": "candidate@demo.ru", "password": "demo1234"},
    )
    assert r.status_code == 200
    assert r.json()["email_verified"] is True
