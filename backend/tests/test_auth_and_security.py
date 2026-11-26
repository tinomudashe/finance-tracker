from datetime import timedelta

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.core.security import create_token, decode_token, hash_password, verify_password


def test_password_hashing_and_jwt_helpers() -> None:
    hashed = hash_password("SuperSecret123!")
    assert hashed != "SuperSecret123!"
    assert verify_password("SuperSecret123!", hashed) is True
    assert verify_password("WrongPassword", hashed) is False

    tok = create_token("user-123", "sess-abc", token_type="access")
    claims = decode_token(tok, expected_type="access")
    assert claims["sub"] == "user-123"
    assert claims["sid"] == "sess-abc"

    with pytest.raises(HTTPException) as exc_type:
        decode_token(tok, expected_type="refresh")
    assert exc_type.value.status_code == 401

    expired = create_token(
        "user-123",
        "sess-abc",
        token_type="access",
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(HTTPException) as exc_exp:
        decode_token(expired, expected_type="access")
    assert exc_exp.value.status_code == 401


async def test_register_login_refresh_profile_and_logout_revocation(client: AsyncClient) -> None:
    # Health check
    health = await client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "healthy"

    # Unauthenticated /me rejected
    unauth = await client.get("/api/auth/me")
    assert unauth.status_code == 401

    # Register user (creates starter categories + sets cookie + returns token)
    reg = await client.post(
        "/api/auth/register",
        json={
            "email": "alice@example.com",
            "password": "AlicePassword123!",
            "full_name": "Alice Marecha",
            "username": "alicem",
        },
    )
    assert reg.status_code == 201
    data = reg.json()
    token = data["access_token"]
    assert data["user"]["email"] == "alice@example.com"
    assert data["user"]["username"] == "alicem"

    # Duplicate email returns 409
    dup = await client.post(
        "/api/auth/register",
        json={
            "email": "alice@example.com",
            "password": "AlicePassword123!",
            "full_name": "Alice Duplicate",
        },
    )
    assert dup.status_code == 409

    # Starter categories seeded
    cats = await client.get("/api/categories", headers={"Authorization": f"Bearer {token}"})
    assert cats.status_code == 200
    assert len(cats.json()) >= 10

    # Update user profile & preferences
    patch_res = await client.patch(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Alice M.",
            "preferences": {"theme": "dark", "language": "pl", "currency": "EUR"},
        },
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["preferences"]["theme"] == "dark"
    assert patch_res.json()["preferences"]["currency"] == "EUR"

    # Refresh token via cookie
    ref_res = await client.post("/api/auth/refresh")
    assert ref_res.status_code == 200
    refreshed_token = ref_res.json()["access_token"]

    # Logout revokes server-side session immediately
    out = await client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {refreshed_token}"},
    )
    assert out.status_code == 200

    after_logout = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {refreshed_token}"},
    )
    assert after_logout.status_code == 401

    # Invalid login rejected, valid login succeeds
    bad_login = await client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "wrong"},
    )
    assert bad_login.status_code == 401

    good_login = await client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "AlicePassword123!"},
    )
    assert good_login.status_code == 200


async def test_demo_login_is_idempotent(client: AsyncClient) -> None:
    res1 = await client.post("/api/auth/demo")
    assert res1.status_code == 200
    res2 = await client.post("/api/auth/demo")
    assert res2.status_code == 200
    assert res1.json()["user"]["id"] == res2.json()["user"]["id"]
