"""Idempotent database seeding script modeled on the FinanceTrace prototype dataset."""
import asyncio
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models import Account, Budget, Category, Transaction, User

DEMO_EMAIL = "daniel.brooks@gmail.com"
DEMO_PASSWORD = "Password123!"


def _hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


async def seed_demo_data(db: AsyncSession) -> User:
    """Populate the database with Daniel Brooks's realistic 6-month finance dataset if missing."""
    existing = await db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if existing:
        prefs = dict(existing.preferences or {})
        changed = False
        if "avatar_style" not in prefs:
            prefs["avatar_style"] = "notionists"
            prefs["avatar_seed"] = existing.full_name or "Daniel Brooks"
            prefs["avatar_bg"] = "0052ff"
            changed = True
        if "font_preset" not in prefs:
            prefs["font_preset"] = "modern"
            changed = True
        if "card_wallpaper" not in prefs:
            prefs["card_wallpaper"] = "contour-blue"
            changed = True
        if changed:
            existing.preferences = prefs
        palette_map = {
            "Salary": ("#0052ff", "wallet"),
            "Freelance": ("#2563eb", "briefcase"),
            "Investment": ("#3b82f6", "trendUp"),
            "Rent": ("#0b0f17", "home"),
            "Groceries": ("#003db3", "shopping"),
            "Dining": ("#1e293b", "utensils"),
            "Transport": ("#00297a", "car"),
            "Utilities": ("#334155", "bolt"),
            "Shopping": ("#60a5fa", "tag"),
            "Entertainment": ("#0f172a", "film"),
            "Healthcare": ("#1d4ed8", "health"),
            "Transfer": ("#475569", "arrowR"),
            "Coffee Shops": ("#1e293b", "utensils"),
        }
        existing_cats = (
            await db.scalars(select(Category).where(Category.user_id == existing.id))
        ).all()
        for cat in existing_cats:
            if cat.name in palette_map:
                new_color, new_icon = palette_map[cat.name]
                if cat.color != new_color or cat.icon != new_icon:
                    cat.color = new_color
                    cat.icon = new_icon
                    changed = True
        if changed:
            await db.commit()
            await db.refresh(existing)
        return existing

    user = User(
        email=DEMO_EMAIL,
        username="danielbrooks",
        full_name="Daniel Brooks",
        password_hash=_hash_pw(DEMO_PASSWORD),
        preferences={
            "theme": "light",
            "language": "en",
            "currency": "USD",
            "avatar_style": "notionists",
            "avatar_seed": "Daniel Brooks",
            "avatar_bg": "0352ff",
            "font_preset": "modern",
            "card_wallpaper": "contour-blue",
        },
    )
    db.add(user)
    await db.flush()

    # Opening balances calibrated so May 2026 balances match the prototype's realistic state
    acct_specs = [
        ("Everyday Checking", "checking", "USD", Decimal("2200.00")),
        ("High-Yield Savings", "savings", "USD", Decimal("25400.00")),
        ("Brokerage", "investment", "USD", Decimal("18100.00")),
        ("Travel Rewards Card", "credit", "USD", Decimal("500.00")),
        ("Cash Wallet", "cash", "USD", Decimal("400.00")),
    ]
    accounts: dict[str, Account] = {}
    for name, atype, cur, opening in acct_specs:
        acct = Account(
            user_id=user.id,
            name=name,
            account_type=atype,
            currency=cur,
            opening_balance=opening,
        )
        db.add(acct)
        accounts[name] = acct
    await db.flush()

    cat_specs = [
        ("Salary", "income", "#0052ff", "wallet", True),
        ("Freelance", "income", "#2563eb", "briefcase", True),
        ("Investment", "income", "#3b82f6", "trendUp", True),
        ("Rent", "expense", "#0b0f17", "home", True),
        ("Groceries", "expense", "#003db3", "shopping", True),
        ("Dining", "expense", "#1e293b", "utensils", True),
        ("Transport", "expense", "#00297a", "car", True),
        ("Utilities", "expense", "#334155", "bolt", True),
        ("Shopping", "expense", "#60a5fa", "tag", True),
        ("Entertainment", "expense", "#0f172a", "film", True),
        ("Healthcare", "expense", "#1d4ed8", "health", True),
        ("Transfer", "transfer", "#475569", "arrowR", True),
    ]
    categories: dict[str, Category] = {}
    for name, ctype, color, icon, is_sys in cat_specs:
        cat = Category(
            user_id=user.id,
            name=name,
            type=ctype,
            color=color,
            icon=icon,
            is_system=is_sys,
        )
        db.add(cat)
        categories[name] = cat
    await db.flush()

    # Sub-category example demonstrating hierarchical self-referencing parent_id
    coffee_sub = Category(
        user_id=user.id,
        parent_id=categories["Dining"].id,
        name="Coffee Shops",
        type="expense",
        color="#1e293b",
        icon="utensils",
        is_system=False,
    )
    db.add(coffee_sub)
    await db.flush()

    # Historical Dec 2025 – Apr 2026 monthly baseline transactions for 6-month charts
    historical_months = [
        (date(2025, 12, 15), Decimal("6200.00"), Decimal("280.00"), Decimal("1450.00"), Decimal("410.00"), Decimal("310.00"), Decimal("240.00")),
        (date(2026, 1, 15), Decimal("6200.00"), Decimal("760.00"), Decimal("1450.00"), Decimal("460.00"), Decimal("340.00"), Decimal("290.00")),
        (date(2026, 2, 15), Decimal("6200.00"), Decimal("510.00"), Decimal("1450.00"), Decimal("390.00"), Decimal("290.00"), Decimal("220.00")),
        (date(2026, 3, 15), Decimal("6200.00"), Decimal("1120.00"), Decimal("1450.00"), Decimal("490.00"), Decimal("380.00"), Decimal("310.00")),
        (date(2026, 4, 15), Decimal("6200.00"), Decimal("690.00"), Decimal("1450.00"), Decimal("430.00"), Decimal("320.00"), Decimal("260.00")),
    ]
    for m_date, sal, free, rent, groc, dine, util in historical_months:
        m_label = m_date.strftime("%b %Y")
        rows = [
            (accounts["Everyday Checking"], categories["Salary"], sal, m_date.replace(day=25), "credit", f"Monthly salary — Northwind Labs ({m_label})"),
            (accounts["Everyday Checking"], categories["Freelance"], free, m_date.replace(day=18), "credit", f"Design consulting ({m_label})"),
            (accounts["Everyday Checking"], categories["Rent"], rent, m_date.replace(day=5), "debit", f"Apartment rent — {m_label}"),
            (accounts["Travel Rewards Card"], categories["Groceries"], groc, m_date.replace(day=10), "debit", f"Monthly groceries — FreshMart ({m_label})"),
            (accounts["Travel Rewards Card"], categories["Dining"], dine, m_date.replace(day=14), "debit", f"Restaurants & dining ({m_label})"),
            (accounts["Travel Rewards Card"], categories["Utilities"], util, m_date.replace(day=20), "debit", f"Electricity & internet ({m_label})"),
        ]
        for acct, cat, amt, tdate, ttype, desc in rows:
            db.add(
                Transaction(
                    user_id=user.id,
                    account_id=acct.id,
                    category_id=cat.id,
                    amount=amt,
                    transaction_date=tdate,
                    type=ttype,
                    description=desc,
                    is_reconciled=True,
                )
            )

    # Detailed May 2026 transactions matching prototype (including over-budget Dining > $350)
    may_txns = [
        (date(2026, 5, 28), "Everyday Checking", "Salary", "credit", Decimal("6200.00"), "Monthly salary — Northwind Labs"),
        (date(2026, 5, 27), "Cash Wallet", "Dining", "debit", Decimal("68.40"), "Lunch — Café Verde"),
        (date(2026, 5, 26), "Travel Rewards Card", "Utilities", "debit", Decimal("158.20"), "Electricity — GridPower"),
        (date(2026, 5, 25), "Everyday Checking", "Rent", "debit", Decimal("1450.00"), "Apartment rent — May"),
        (date(2026, 5, 24), "Everyday Checking", "Freelance", "credit", Decimal("850.00"), "Design retainer — Atlas Co."),
        (date(2026, 5, 23), "Travel Rewards Card", "Groceries", "debit", Decimal("232.65"), "Weekly groceries — FreshMart"),
        (date(2026, 5, 22), "Travel Rewards Card", "Transport", "debit", Decimal("119.00"), "Monthly transit pass"),
        (date(2026, 5, 21), "Everyday Checking", "Shopping", "debit", Decimal("119.99"), "Running shoes — Stride"),
        (date(2026, 5, 20), "Brokerage", "Investment", "credit", Decimal("142.30"), "Dividend — Index Fund"),
        (date(2026, 5, 19), "Travel Rewards Card", "Dining", "debit", Decimal("185.50"), "Dinner — Sora Sushi"),
        (date(2026, 5, 18), "Everyday Checking", "Healthcare", "debit", Decimal("42.10"), "Pharmacy — Wellbridge"),
        (date(2026, 5, 16), "Travel Rewards Card", "Entertainment", "debit", Decimal("96.00"), "Concert tickets"),
        (date(2026, 5, 15), "Everyday Checking", "Transfer", "transfer", Decimal("1000.00"), "Transfer to High-Yield Savings"),
        (date(2026, 5, 14), "Travel Rewards Card", "Groceries", "debit", Decimal("88.20"), "Groceries — FreshMart"),
        (date(2026, 5, 12), "Travel Rewards Card", "Utilities", "debit", Decimal("64.00"), "Internet — FiberOne"),
        (date(2026, 5, 11), "Cash Wallet", "Dining", "debit", Decimal("86.75"), "Coffee & team lunch — Roast House"),
        (date(2026, 5, 9), "Travel Rewards Card", "Shopping", "debit", Decimal("54.30"), "Home supplies — Nestwell"),
        (date(2026, 5, 7), "Travel Rewards Card", "Transport", "debit", Decimal("23.40"), "Ride share"),
        (date(2026, 5, 5), "Everyday Checking", "Freelance", "credit", Decimal("480.00"), "Logo project — Bloom Studio"),
        (date(2026, 5, 3), "Travel Rewards Card", "Entertainment", "debit", Decimal("31.97"), "Streaming bundle"),
        (date(2026, 5, 2), "Travel Rewards Card", "Groceries", "debit", Decimal("101.45"), "Groceries — FreshMart"),
        (date(2026, 5, 1), "Travel Rewards Card", "Dining", "debit", Decimal("47.80"), "Brunch — Maple & Rye"),
    ]
    for tdate, acct_name, cat_name, ttype, amt, desc in may_txns:
        db.add(
            Transaction(
                user_id=user.id,
                account_id=accounts[acct_name].id,
                category_id=categories[cat_name].id,
                amount=amt,
                transaction_date=tdate,
                type=ttype,
                description=desc,
                is_reconciled=True,
            )
        )

    # 6 monthly budgets for May 2026 matching prototype (Dining spent $388.45 > $350 limit!)
    budget_specs = [
        ("Groceries", Decimal("600.00")),
        ("Dining", Decimal("350.00")),
        ("Transport", Decimal("200.00")),
        ("Utilities", Decimal("250.00")),
        ("Entertainment", Decimal("150.00")),
        ("Shopping", Decimal("300.00")),
    ]
    for cat_name, limit_amt in budget_specs:
        db.add(
            Budget(
                user_id=user.id,
                category_id=categories[cat_name].id,
                name=f"{cat_name} Budget — May 2026",
                amount_limit=limit_amt,
                period="monthly",
                start_date=date(2026, 5, 1),
                end_date=date(2026, 5, 31),
                alert_threshold=Decimal("80.00"),
            )
        )

    await db.commit()
    await db.refresh(user)
    return user


async def main() -> None:
    async with AsyncSessionLocal() as db:
        user = await seed_demo_data(db)
        print(f"Seed complete for demo user: {user.email} (password: {DEMO_PASSWORD})")


if __name__ == "__main__":
    asyncio.run(main())
