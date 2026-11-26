from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import store
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas import DashboardSummary, NotificationItem
from app.services.ledger import build_dashboard_summary, build_notifications

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    reference_date: Optional[date] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardSummary:
    cache_key = f"cache:dash:{current_user.id}:{reference_date or 'latest'}"
    cached = await store.cache_get(cache_key)
    if cached is not None:
        return DashboardSummary.model_validate(cached)

    summary = await build_dashboard_summary(db, current_user.id, reference_date=reference_date)
    await store.cache_set(cache_key, summary.model_dump(mode="json"))
    return summary


@router.get("/notifications", response_model=list[NotificationItem])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationItem]:
    return await build_notifications(db, current_user.id)
