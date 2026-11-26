from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas import UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_profile(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch("/me", response_model=UserRead)
async def update_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    if payload.email is not None:
        email_norm = payload.email.lower().strip()
        if email_norm != current_user.email:
            exists = await db.scalar(select(User).where(User.email == email_norm))
            if exists:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email is already in use",
                )
            current_user.email = email_norm

    if payload.username is not None:
        uname = payload.username.strip()
        if uname != current_user.username:
            exists_u = await db.scalar(select(User).where(User.username == uname))
            if exists_u:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Username is already taken",
                )
            current_user.username = uname

    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()

    if payload.preferences is not None:
        current_user.preferences = payload.preferences.model_dump()

    await db.commit()
    await db.refresh(current_user)
    return UserRead.model_validate(current_user)
