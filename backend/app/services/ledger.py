import calendar
import uuid
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, Budget, Category, Transaction
from app.schemas import (
    AccountMiniTx,
    AccountRead,
    BudgetUtilizationRead,
    CategoryBreakdownItem,
    DashboardSummary,
    NotificationItem,
    ReportAnalyticsSummary,
    TransactionRead,
    TrendPoint,
)

TWO_PLACES = Decimal("0.01")


def signed_tx_amount(amount: Decimal, tx_type: str) -> Decimal:
    return amount if tx_type == "credit" else -amount


def serialize_transaction(
    tx: Transaction,
    acct_map: dict[uuid.UUID, Account],
    cat_map: dict[uuid.UUID, Category],
) -> TransactionRead:
    acct = acct_map.get(tx.account_id)
    cat = cat_map.get(tx.category_id)
    return TransactionRead(
        id=tx.id,
        account_id=tx.account_id,
        account_name=acct.name if acct else "Unknown",
        category_id=tx.category_id,
        category_name=cat.name if cat else "Uncategorized",
        category_color=cat.color if cat else "#0176d3",
        user_id=tx.user_id,
        amount=tx.amount,
        signed_amount=signed_tx_amount(tx.amount, tx.type),
        transaction_date=tx.transaction_date,
        type=tx.type,  # type: ignore[arg-type]
        description=tx.description,
        reference_no=tx.reference_no,
        is_reconciled=tx.is_reconciled,
        created_at=tx.created_at,
    )


async def build_accounts_with_balances(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[AccountRead]:
    accounts = list(
        await db.scalars(
            select(Account)
            .where(Account.user_id == user_id)
            .order_by(Account.created_at.asc(), Account.name.asc())
        )
    )
    txns = list(
        await db.scalars(
            select(Transaction)
            .where(Transaction.user_id == user_id)
            .order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        )
    )

    by_acct: dict[uuid.UUID, list[Transaction]] = defaultdict(list)
    for t in txns:
        by_acct[t.account_id].append(t)

    result: list[AccountRead] = []
    for a in accounts:
        acct_txns = by_acct.get(a.id, [])
        money_in = sum((t.amount for t in acct_txns if t.type == "credit"), Decimal("0.00"))
        money_out = sum(
            (t.amount for t in acct_txns if t.type in ("debit", "transfer")),
            Decimal("0.00"),
        )
        current_bal = (a.opening_balance + money_in - money_out).quantize(TWO_PLACES)
        recent_mini = [
            AccountMiniTx(
                id=t.id,
                transaction_date=t.transaction_date,
                description=t.description,
                type=t.type,
                amount=t.amount,
                signed_amount=signed_tx_amount(t.amount, t.type),
            )
            for t in acct_txns[:3]
        ]
        result.append(
            AccountRead(
                id=a.id,
                user_id=a.user_id,
                name=a.name,
                account_type=a.account_type,  # type: ignore[arg-type]
                currency=a.currency.strip(),
                opening_balance=a.opening_balance,
                current_balance=current_bal,
                money_in=money_in,
                money_out=-money_out if money_out > 0 else Decimal("0.00"),
                is_active=a.is_active,
                recent_transactions=recent_mini,
            )
        )
    return result


async def compute_budget_utilizations(
    db: AsyncSession,
    user_id: uuid.UUID,
    month_filter: date | None = None,
) -> list[BudgetUtilizationRead]:
    stmt = select(Budget).where(Budget.user_id == user_id).order_by(Budget.start_date.desc(), Budget.name.asc())
    budgets = list(await db.scalars(stmt))
    if month_filter is not None:
        m_start = month_filter.replace(day=1)
        last_day = calendar.monthrange(month_filter.year, month_filter.month)[1]
        m_end = month_filter.replace(day=last_day)
        budgets = [b for b in budgets if b.start_date <= m_end and b.end_date >= m_start]

    if not budgets:
        return []

    cats = {
        c.id: c
        for c in await db.scalars(select(Category).where(Category.user_id == user_id))
    }
    txns = list(
        await db.scalars(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.type == "debit",
            )
        )
    )

    output: list[BudgetUtilizationRead] = []
    for b in budgets:
        spent = sum(
            (
                t.amount
                for t in txns
                if t.category_id == b.category_id
                and b.start_date <= t.transaction_date <= b.end_date
            ),
            Decimal("0.00"),
        ).quantize(TWO_PLACES)
        remaining = (b.amount_limit - spent).quantize(TWO_PLACES)
        pct = (
            (spent / b.amount_limit * Decimal("100")).quantize(TWO_PLACES)
            if b.amount_limit > 0
            else Decimal("0.00")
        )
        cat = cats.get(b.category_id)
        output.append(
            BudgetUtilizationRead(
                id=b.id,
                user_id=b.user_id,
                category_id=b.category_id,
                category_name=cat.name if cat else "Category",
                category_color=cat.color if cat else "#0176d3",
                name=b.name,
                amount_limit=b.amount_limit,
                period=b.period,  # type: ignore[arg-type]
                start_date=b.start_date,
                end_date=b.end_date,
                alert_threshold=b.alert_threshold,
                amount_spent=spent,
                remaining_balance=remaining,
                pct_used=pct,
                alert_triggered=pct >= b.alert_threshold,
                over_budget=spent > b.amount_limit,
            )
        )
    return output


def _shift_month(d: date, delta_months: int) -> tuple[int, int]:
    total = d.year * 12 + (d.month - 1) + delta_months
    return total // 12, (total % 12) + 1


async def resolve_reference_date(db: AsyncSession, user_id: uuid.UUID, ref: date | None) -> date:
    if ref is not None:
        return ref
    latest_tx = await db.scalar(
        select(Transaction.transaction_date)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.transaction_date.desc())
        .limit(1)
    )
    return latest_tx or date.today()


async def build_dashboard_summary(
    db: AsyncSession,
    user_id: uuid.UUID,
    reference_date: date | None = None,
) -> DashboardSummary:
    ref = await resolve_reference_date(db, user_id, reference_date)
    accounts = await build_accounts_with_balances(db, user_id)
    net_worth = sum((a.current_balance for a in accounts), Decimal("0.00"))

    cats = {
        c.id: c
        for c in await db.scalars(select(Category).where(Category.user_id == user_id))
    }
    acct_models = {
        a.id: a
        for a in await db.scalars(select(Account).where(Account.user_id == user_id))
    }
    txns = list(
        await db.scalars(
            select(Transaction)
            .where(Transaction.user_id == user_id)
            .order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        )
    )

    cur_ym = (ref.year, ref.month)
    prev_ym = _shift_month(ref, -1)

    def month_totals(ym: tuple[int, int]) -> tuple[Decimal, Decimal]:
        inc = sum(
            (
                t.amount
                for t in txns
                if (t.transaction_date.year, t.transaction_date.month) == ym
                and t.type == "credit"
            ),
            Decimal("0.00"),
        )
        exp = sum(
            (
                t.amount
                for t in txns
                if (t.transaction_date.year, t.transaction_date.month) == ym
                and t.type == "debit"
            ),
            Decimal("0.00"),
        )
        return inc.quantize(TWO_PLACES), exp.quantize(TWO_PLACES)

    month_inc, month_exp = month_totals(cur_ym)
    prev_inc, prev_exp = month_totals(prev_ym)

    savings_rate = (
        max(0, round(float((month_inc - month_exp) / month_inc * 100)))
        if month_inc > 0
        else 0
    )
    inc_delta = (
        round(float((month_inc - prev_inc) / prev_inc * 100), 1)
        if prev_inc > 0
        else 0.0
    )
    exp_delta = (
        round(float((month_exp - prev_exp) / prev_exp * 100), 1)
        if prev_exp > 0
        else 0.0
    )
    month_net = month_inc - month_exp
    prior_nw = net_worth - month_net
    nw_delta = (
        round(float(month_net / abs(prior_nw) * 100), 1)
        if prior_nw != 0
        else 0.0
    )

    trend: list[TrendPoint] = []
    for offset in range(-5, 1):
        y, m = _shift_month(ref, offset)
        t_inc, t_exp = month_totals((y, m))
        trend.append(
            TrendPoint(
                month=date(y, m, 1).strftime("%b"),
                income=t_inc,
                expense=t_exp,
            )
        )

    cat_totals: dict[uuid.UUID, Decimal] = defaultdict(lambda: Decimal("0.00"))
    for t in txns:
        if (t.transaction_date.year, t.transaction_date.month) == cur_ym and t.type == "debit":
            cat_totals[t.category_id] += t.amount

    total_cat_exp = sum(cat_totals.values(), Decimal("0.00"))
    breakdown: list[CategoryBreakdownItem] = []
    for cid, val in sorted(cat_totals.items(), key=lambda kv: kv[1], reverse=True):
        c = cats.get(cid)
        pct = round(float(val / total_cat_exp * 100), 1) if total_cat_exp > 0 else 0.0
        breakdown.append(
            CategoryBreakdownItem(
                category_id=cid,
                label=c.name if c else "Other",
                value=val.quantize(TWO_PLACES),
                pct=pct,
                color=c.color if c else "#0176d3",
            )
        )

    budgets = await compute_budget_utilizations(db, user_id, month_filter=ref)
    if not budgets:
        budgets = await compute_budget_utilizations(db, user_id, month_filter=None)

    recent = [serialize_transaction(t, acct_models, cats) for t in txns[:6]]

    return DashboardSummary(
        reference_month=ref.strftime("%B %Y"),
        net_worth=net_worth,
        month_income=month_inc,
        month_expense=month_exp,
        savings_rate=savings_rate,
        income_delta_pct=inc_delta,
        expense_delta_pct=exp_delta,
        net_worth_delta_pct=nw_delta,
        trend=trend,
        breakdown=breakdown,
        budgets=budgets,
        recent_transactions=recent,
    )


async def build_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[NotificationItem]:
    summary = await build_dashboard_summary(db, user_id)
    items: list[NotificationItem] = []

    for b in summary.budgets:
        if b.over_budget:
            items.append(
                NotificationItem(
                    id=f"budget-over-{b.id}",
                    title=f"{b.category_name} is over budget",
                    body=f"You've spent ${b.amount_spent:,.2f} of your ${b.amount_limit:,.2f} {b.category_name.lower()} budget.",
                    time="Active alert",
                    kind="warn",
                )
            )
        elif b.alert_triggered:
            items.append(
                NotificationItem(
                    id=f"budget-near-{b.id}",
                    title=f"{b.category_name} nearing limit ({b.pct_used}%)",
                    body=f"${b.remaining_balance:,.2f} remaining of ${b.amount_limit:,.2f} limit.",
                    time="Threshold alert",
                    kind="warn",
                )
            )

    for tx in summary.recent_transactions:
        if tx.type == "credit" and tx.amount >= Decimal("500.00"):
            items.append(
                NotificationItem(
                    id=f"tx-credit-{tx.id}",
                    title=f"{tx.category_name} received",
                    body=f"${tx.amount:,.2f} deposited to {tx.account_name}.",
                    time=tx.transaction_date.strftime("%b %d"),
                    kind="pos",
                )
            )
            break

    if summary.savings_rate >= 20:
        items.append(
            NotificationItem(
                id="savings-milestone",
                title="Savings goal on track",
                body=f"You saved {summary.savings_rate}% of income in {summary.reference_month}.",
                time="Monthly insight",
                kind="info",
            )
        )

    return items


async def build_report_analytics(
    db: AsyncSession,
    user_id: uuid.UUID,
    start_date: date,
    end_date: date,
    label: str = "Custom Period",
) -> ReportAnalyticsSummary:
    cats = {
        c.id: c
        for c in await db.scalars(select(Category).where(Category.user_id == user_id))
    }
    txns = list(
        await db.scalars(
            select(Transaction)
            .where(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date,
            )
            .order_by(Transaction.transaction_date.asc())
        )
    )

    total_inc = sum((t.amount for t in txns if t.type == "credit"), Decimal("0.00")).quantize(TWO_PLACES)
    total_exp = sum((t.amount for t in txns if t.type == "debit"), Decimal("0.00")).quantize(TWO_PLACES)
    net = (total_inc - total_exp).quantize(TWO_PLACES)

    monthly_inc: dict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0.00"))
    monthly_exp: dict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0.00"))
    cat_totals: dict[uuid.UUID, Decimal] = defaultdict(lambda: Decimal("0.00"))

    for t in txns:
        ym = (t.transaction_date.year, t.transaction_date.month)
        if t.type == "credit":
            monthly_inc[ym] += t.amount
        elif t.type == "debit":
            monthly_exp[ym] += t.amount
            cat_totals[t.category_id] += t.amount

    # Walk every month in [start_date, end_date]
    trend: list[TrendPoint] = []
    cur_y, cur_m = start_date.year, start_date.month
    while (cur_y, cur_m) <= (end_date.year, end_date.month):
        trend.append(
            TrendPoint(
                month=date(cur_y, cur_m, 1).strftime("%b %y"),
                income=monthly_inc[(cur_y, cur_m)].quantize(TWO_PLACES),
                expense=monthly_exp[(cur_y, cur_m)].quantize(TWO_PLACES),
            )
        )
        cur_y, cur_m = _shift_month(date(cur_y, cur_m, 1), 1)

    breakdown: list[CategoryBreakdownItem] = []
    for cid, val in sorted(cat_totals.items(), key=lambda kv: kv[1], reverse=True):
        c = cats.get(cid)
        pct = round(float(val / total_exp * 100), 1) if total_exp > 0 else 0.0
        breakdown.append(
            CategoryBreakdownItem(
                category_id=cid,
                label=c.name if c else "Other",
                value=val.quantize(TWO_PLACES),
                pct=pct,
                color=c.color if c else "#0176d3",
            )
        )

    return ReportAnalyticsSummary(
        period_label=label,
        start_date=start_date,
        end_date=end_date,
        total_income=total_inc,
        total_expense=total_exp,
        net_savings=net,
        transaction_count=len(txns),
        trend=trend,
        breakdown=breakdown,
    )
