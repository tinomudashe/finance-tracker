import calendar
import uuid
from datetime import date
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Account, Category, Report, Transaction, User
from app.schemas import ReportAnalyticsSummary, ReportGenerateRequest, ReportRead
from app.services.exporters import generate_excel_report
from app.services.ledger import (
    _shift_month,
    build_report_analytics,
    resolve_reference_date,
    serialize_transaction,
)
from app.tasks.worker_tasks import build_report_pdf_for_record

router = APIRouter(prefix="/reports", tags=["reports"])

PERIOD_LABELS = {
    "1m": ("Last Month", 0),
    "3m": ("Last 3 Months", -2),
    "6m": ("Last 6 Months", -5),
    "1y": ("Last Year", -11),
}


async def _resolve_window(
    db: AsyncSession,
    user_id: uuid.UUID,
    period: Literal["1m", "3m", "6m", "1y"],
    start_date: Optional[date],
    end_date: Optional[date],
) -> tuple[date, date, str]:
    if start_date and end_date:
        if end_date < start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="end_date must be on or after start_date",
            )
        return start_date, end_date, f"{start_date.isoformat()} to {end_date.isoformat()}"

    ref = await resolve_reference_date(db, user_id, None)
    label, offset = PERIOD_LABELS.get(period, ("Last 3 Months", -2))
    sy, sm = _shift_month(ref, offset)
    s_date = date(sy, sm, 1)
    last_day = calendar.monthrange(ref.year, ref.month)[1]
    e_date = date(ref.year, ref.month, last_day)
    return s_date, e_date, label


@router.get("/analytics", response_model=ReportAnalyticsSummary)
async def get_report_analytics(
    period: Literal["1m", "3m", "6m", "1y"] = Query(default="3m"),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportAnalyticsSummary:
    s_date, e_date, label = await _resolve_window(db, current_user.id, period, start_date, end_date)
    return await build_report_analytics(db, current_user.id, s_date, e_date, label=label)


@router.get("/export.xlsx")
async def export_reports_excel(
    period: Literal["1m", "3m", "6m", "1y"] = Query(default="3m"),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    s_date, e_date, label = await _resolve_window(db, current_user.id, period, start_date, end_date)
    analytics = await build_report_analytics(db, current_user.id, s_date, e_date, label=label)
    accts = {
        a.id: a for a in await db.scalars(select(Account).where(Account.user_id == current_user.id))
    }
    cats = {
        c.id: c
        for c in await db.scalars(select(Category).where(Category.user_id == current_user.id))
    }
    txns = list(
        await db.scalars(
            select(Transaction)
            .where(
                Transaction.user_id == current_user.id,
                Transaction.transaction_date >= s_date,
                Transaction.transaction_date <= e_date,
            )
            .order_by(Transaction.transaction_date.desc())
        )
    )
    serialized = [serialize_transaction(t, accts, cats) for t in txns]
    xlsx_bytes = generate_excel_report(analytics, serialized)
    filename = f"FinanceTrace_Report_{s_date.isoformat()}_{e_date.isoformat()}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("", response_model=list[ReportRead])
async def list_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ReportRead]:
    rows = list(
        await db.scalars(
            select(Report)
            .where(Report.user_id == current_user.id)
            .order_by(Report.created_at.desc())
        )
    )
    return [ReportRead.model_validate(r) for r in rows]


@router.post("/generate", response_model=ReportRead, status_code=status.HTTP_201_CREATED)
async def generate_pdf_report(
    payload: ReportGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportRead:
    rep = Report(
        user_id=current_user.id,
        title=payload.title.strip(),
        report_type=payload.report_type,
        period_start=payload.period_start,
        period_end=payload.period_end,
        status="pending",
    )
    db.add(rep)
    await db.commit()
    await db.refresh(rep)

    # Generate PDF directly if no external worker picks it up immediately, ensuring instant reliability
    updated = await build_report_pdf_for_record(db, rep.id)
    return ReportRead.model_validate(updated or rep)


@router.get("/{report_id}", response_model=ReportRead)
async def get_report_status(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportRead:
    rep = await db.scalar(
        select(Report).where(Report.id == report_id, Report.user_id == current_user.id)
    )
    if not rep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return ReportRead.model_validate(rep)


@router.get("/{report_id}/download")
async def download_report_pdf(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    rep = await db.scalar(
        select(Report).where(Report.id == report_id, Report.user_id == current_user.id)
    )
    if not rep or rep.status != "completed" or not rep.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Completed PDF report not found")
    path = Path(rep.file_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file missing on disk")
    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        filename=f"{rep.title.replace(' ', '_')}.pdf",
    )
