import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import store
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Budget, Category, Transaction, User
from app.schemas import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CategoryRead]:
    rows = list(
        await db.scalars(
            select(Category)
            .where(Category.user_id == current_user.id)
            .order_by(Category.type.asc(), Category.name.asc())
        )
    )
    return [CategoryRead.model_validate(c) for c in rows]


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategoryRead:
    if payload.parent_id is not None:
        parent = await db.scalar(
            select(Category).where(
                Category.id == payload.parent_id,
                Category.user_id == current_user.id,
            )
        )
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent category not found")

    cat = Category(
        user_id=current_user.id,
        parent_id=payload.parent_id,
        name=payload.name.strip(),
        type=payload.type,
        color=payload.color,
        icon=payload.icon,
        is_system=False,
    )
    db.add(cat)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name already exists",
        ) from exc

    await db.refresh(cat)
    await store.invalidate_user_cache(str(current_user.id))
    return CategoryRead.model_validate(cat)


@router.put("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategoryRead:
    cat = await db.scalar(
        select(Category).where(Category.id == category_id, Category.user_id == current_user.id)
    )
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if payload.name is not None:
        cat.name = payload.name.strip()
    if payload.type is not None:
        cat.type = payload.type
    if payload.color is not None:
        cat.color = payload.color
    if payload.icon is not None:
        cat.icon = payload.icon
    if "parent_id" in payload.model_fields_set:
        if payload.parent_id == category_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category cannot be its own parent")
        cat.parent_id = payload.parent_id

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name conflicts with an existing category",
        ) from exc

    await db.refresh(cat)
    await store.invalidate_user_cache(str(current_user.id))
    return CategoryRead.model_validate(cat)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    cat = await db.scalar(
        select(Category).where(Category.id == category_id, Category.user_id == current_user.id)
    )
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    tx_refs = await db.scalar(
        select(func.count()).select_from(Transaction).where(Transaction.category_id == category_id)
    )
    budget_refs = await db.scalar(
        select(func.count()).select_from(Budget).where(Budget.category_id == category_id)
    )
    if (tx_refs and tx_refs > 0) or (budget_refs and budget_refs > 0):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a category linked to existing transactions or budgets (ON DELETE RESTRICT).",
        )

    await db.execute(
        update(Category).where(Category.parent_id == category_id).values(parent_id=None)
    )
    await db.delete(cat)
    await db.commit()
    await store.invalidate_user_cache(str(current_user.id))
