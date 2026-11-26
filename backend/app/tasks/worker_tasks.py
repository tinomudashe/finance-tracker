import asyncio
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models import Account, Category, Report, Transaction, User
from app.services.categorizer import suggest_category_for_text
from app.services.exporters import generate_pdf_report_file
from app.services.ledger import build_report_analytics, serialize_transaction
from app.tasks.celery_app import celery_app


async def build_report_pdf_for_record(db: AsyncSession, report_id: uuid.UUID) -> Report | None:
    report = await db.scalar(select(Report).where(Report.id == report_id))
    if not report:
        return None
    try:
        analytics = await build_report_analytics(
            db,
            report.user_id,
            report.period_start,
            report.period_end,
            label=report.title,
        )
        acct_map = {
            a.id: a
            for a in await db.scalars(select(Account).where(Account.user_id == report.user_id))
        }
        cat_map = {
            c.id: c
            for c in await db.scalars(select(Category).where(Category.user_id == report.user_id))
        }
        txns = list(
            await db.scalars(
                select(Transaction)
                .where(
                    Transaction.user_id == report.user_id,
                    Transaction.transaction_date >= report.period_start,
                    Transaction.transaction_date <= report.period_end,
                )
                .order_by(Transaction.transaction_date.desc())
            )
        )
        serialized = [serialize_transaction(t, acct_map, cat_map) for t in txns]
        out_path = Path(settings.REPORTS_DIR) / f"report_{report.id}.pdf"
        generate_pdf_report_file(out_path, report.title, analytics, serialized)
        report.file_path = str(out_path)
        report.status = "completed"
        report.generated_at = datetime.now(timezone.utc)
    except Exception:
        report.status = "failed"
    await db.commit()
    await db.refresh(report)
    return report


@celery_app.task(name="app.tasks.worker_tasks.generate_report_task")
def generate_report_task(report_id_str: str) -> str:
    async def _run() -> str:
        async with AsyncSessionLocal() as db:
            rep = await build_report_pdf_for_record(db, uuid.UUID(report_id_str))
            return rep.status if rep else "not_found"

    return asyncio.run(_run())


@celery_app.task(name="app.tasks.worker_tasks.auto_categorize_task")
def auto_categorize_task(transaction_id_str: str) -> str:
    async def _run() -> str:
        async with AsyncSessionLocal() as db:
            tx = await db.scalar(
                select(Transaction).where(Transaction.id == uuid.UUID(transaction_id_str))
            )
            if not tx or not tx.description:
                return "skipped"
            cat_id, cat_name, _ = await suggest_category_for_text(
                db, tx.user_id, tx.description, tx.type
            )
            if cat_id:
                tx.category_id = cat_id
                await db.commit()
                return cat_name or "updated"
            return "no_match"

    return asyncio.run(_run())


@celery_app.task(name="app.tasks.worker_tasks.monthly_summary_task")
def monthly_summary_task() -> int:
    async def _run() -> int:
        today = date.today()
        first_this_month = today.replace(day=1)
        prev_end = date.fromordinal(first_this_month.toordinal() - 1)
        prev_start = prev_end.replace(day=1)
        count = 0
        async with AsyncSessionLocal() as db:
            users = list(await db.scalars(select(User).where(User.is_active.is_(True))))
            for u in users:
                rep = Report(
                    user_id=u.id,
                    title=f"Monthly Summary - {prev_start.strftime('%B %Y')}",
                    report_type="monthly",
                    period_start=prev_start,
                    period_end=prev_end,
                    status="pending",
                )
                db.add(rep)
                await db.flush()
                await build_report_pdf_for_record(db, rep.id)
                count += 1
        return count

    return asyncio.run(_run())
