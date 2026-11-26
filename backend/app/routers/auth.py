import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import store
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import create_token, decode_token, hash_password, verify_password
from app.db.session import get_db
from app.models import Category, User
from app.schemas import AuthResponse, LoginRequest, RegisterRequest, UserRead
from scripts.seed import seed_demo_data

router = APIRouter(prefix="/auth", tags=["auth"])

STARTER_CATEGORIES = [
    ("Salary", "income", "#0176d3", "trendUp"),
    ("Freelance", "income", "#014486", "trendUp"),
    ("Investment", "income", "#057ed4", "trendUp"),
    ("Rent", "expense", "#032d60", "building"),
    ("Groceries", "expense", "#014486", "tag"),
    ("Dining", "expense", "#0176d3", "tag"),
    ("Transport", "expense", "#1b96ff", "tag"),
    ("Utilities", "expense", "#05628a", "tag"),
    ("Shopping", "expense", "#90d0fe", "tag"),
    ("Entertainment", "expense", "#057ed4", "tag"),
    ("Healthcare", "expense", "#57b7f5", "tag"),
    ("Transfer", "transfer", "#706e6b", "arrowR"),
]


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth",
    )


async def _issue_session_tokens(response: Response, user: User) -> AuthResponse:
    session_id = str(uuid.uuid4())
    await store.store_session(str(user.id), session_id)
    access_token = create_token(str(user.id), session_id, token_type="access")
    refresh_token = create_token(str(user.id), session_id, token_type="refresh")
    _set_auth_cookies(response, access_token, refresh_token)
    return AuthResponse(access_token=access_token, user=UserRead.model_validate(user))


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    email_norm = payload.email.lower().strip()
    existing_email = await db.scalar(select(User).where(User.email == email_norm))
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    username = (payload.username or email_norm.split("@")[0])[:50]
    existing_uname = await db.scalar(select(User).where(User.username == username))
    if existing_uname:
        if payload.username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username is already taken",
            )
        username = f"{username[:40]}_{uuid.uuid4().hex[:6]}"

    user = User(
        email=email_norm,
        username=username,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        preferences={"theme": "light", "language": "en", "currency": "USD"},
    )
    db.add(user)
    await db.flush()

    if payload.seed_starter_categories:
        for cname, ctype, color, icon in STARTER_CATEGORIES:
            db.add(
                Category(
                    user_id=user.id,
                    name=cname,
                    type=ctype,
                    color=color,
                    icon=icon,
                    is_system=True,
                )
            )

    await db.commit()
    await db.refresh(user)
    return await _issue_session_tokens(response, user)


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    email_norm = payload.email.lower().strip()
    user = await db.scalar(select(User).where(User.email == email_norm))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )
    return await _issue_session_tokens(response, user)


@router.post("/demo", response_model=AuthResponse)
async def demo_login(
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Ensure the Daniel Brooks demo dataset exists and sign in immediately."""
    user = await seed_demo_data(db)
    return await _issue_session_tokens(response, user)


@router.post("/refresh", response_model=AuthResponse)
async def refresh_access_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    refresh_tok = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not refresh_tok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )
    claims = decode_token(refresh_tok, expected_type="refresh")
    uid = claims["sub"]
    sid = claims["sid"]
    if not await store.is_session_active(uid, sid):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked",
        )
    user = await db.scalar(select(User).where(User.id == uuid.UUID(uid)))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    new_access = create_token(str(user.id), sid, token_type="access")
    _set_auth_cookies(response, new_access, refresh_tok)
    return AuthResponse(access_token=new_access, user=UserRead.model_validate(user))


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    sid = getattr(request.state, "session_id", None)
    if sid:
        await store.revoke_session(str(current_user.id), sid)
    response.delete_cookie(settings.COOKIE_NAME, path="/")
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path="/api/auth")
    return {"status": "logged_out"}


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
