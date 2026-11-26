import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import store
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Budget, Category, User
from app.schemas import BudgetCreate, BudgetUpdate, BudgetUtilizationRead
from app.services.ledger import compute_budget_utilizations

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetUtilizationRead])
async def list_budgets(
    month: Optional[date] = Query(default=None, description="Optional YYYY-MM-DD within target month"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BudgetUtilizationRead]:
    return await compute_budget_utilizations(db, current_user.id, month_filter=month)


@router.post("", response_model=BudgetUtilizationRead, status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetUtilizationRead:
    cat = await db.scalar(
        select(Category).where(
            Category.id == payload.category_id,
            Category.user_id == current_user.id,
        )
    )
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    budget = Budget(
        user_id=current_user.id,
        category_id=payload.category_id,
        name=payload.name.strip(),
        amount_limit=payload.amount_limit,
        period=payload.period,
        start_date=payload.start_date,
        end_date=payload.end_date,
        alert_threshold=payload.alert_threshold,
    )
    db.add(budget)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A budget for this category and start date already exists",
        ) from exc

    await store.invalidate_user_cache(str(current_user.id))
    items = await compute_budget_utilizations(db, current_user.id)
    return next(b for b in items if b.id == budget.id)


@router.put("/{budget_id}", response_model=BudgetUtilizationRead)
async def update_budget(
    budget_id: uuid.UUID,
    payload: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetUtilizationRead:
    budget = await db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == current_user.id)
    )
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    if payload.name is not None:
        budget.name = payload.name.strip()
    if payload.amount_limit is not None:
        budget.amount_limit = payload.amount_limit
    if payload.period is not None:
        budget.period = payload.period
    if payload.start_date is not None:
        budget.start_date = payload.start_date
    if payload.end_date is not None:
        budget.end_date = payload.end_date
    if payload.alert_threshold is not None:
        budget.alert_threshold = payload.alert_threshold

    if budget.end_date <= budget.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be after start_date",
        )

    await db.commit()
    await store.invalidate_user_cache(str(current_user.id))
    items = await compute_budget_utilizations(db, current_user.id)
    return next(b for b in items if b.id == budget_id)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    budget = await db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == current_user.id)
    )
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    await db.delete(budget)
    await db.commit()
    await store.invalidate_user_cache(str(current_user.id))
