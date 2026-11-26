import hashlib
import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import store
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Account, Category, Transaction, User
from app.schemas import (
    CategorySuggestionRequest,
    CategorySuggestionResponse,
    PaginatedTransactions,
    TransactionCreate,
    TransactionRead,
    TransactionUpdate,
)
from app.services.categorizer import suggest_category_for_text
from app.services.ledger import serialize_transaction

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _normalize_type_filter(t: Optional[str]) -> Optional[str]:
    if not t or t == "all":
        return None
    mapping = {"income": "credit", "expense": "debit"}
    return mapping.get(t, t)


async def _load_maps(
    db: AsyncSession, user_id: uuid.UUID
) -> tuple[dict[uuid.UUID, Account], dict[uuid.UUID, Category]]:
    accts = {
        a.id: a for a in await db.scalars(select(Account).where(Account.user_id == user_id))
    }
    cats = {
        c.id: c for c in await db.scalars(select(Category).where(Category.user_id == user_id))
    }
    return accts, cats


@router.get("", response_model=PaginatedTransactions)
async def list_transactions(
    q: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None),
    account_id: Optional[uuid.UUID] = Query(default=None),
    category_id: Optional[uuid.UUID] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=250),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedTransactions:
    raw_key = f"{q}|{type}|{account_id}|{category_id}|{date_from}|{date_to}|{page}|{limit}"
    cache_hash = hashlib.sha1(raw_key.encode("utf-8")).hexdigest()[:16]
    cache_key = f"cache:tx:{current_user.id}:{cache_hash}"

    cached = await store.cache_get(cache_key)
    if cached is not None:
        return PaginatedTransactions.model_validate(cached)

    acct_map, cat_map = await _load_maps(db, current_user.id)

    stmt = select(Transaction).where(Transaction.user_id == current_user.id)
    norm_type = _normalize_type_filter(type)
    if norm_type:
        stmt = stmt.where(Transaction.type == norm_type)
    if account_id:
        stmt = stmt.where(Transaction.account_id == account_id)
    if category_id:
        stmt = stmt.where(Transaction.category_id == category_id)
    if date_from:
        stmt = stmt.where(Transaction.transaction_date >= date_from)
    if date_to:
        stmt = stmt.where(Transaction.transaction_date <= date_to)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        matching_cat_ids = [
            cid for cid, c in cat_map.items() if q.strip().lower() in c.name.lower()
        ]
        if matching_cat_ids:
            stmt = stmt.where(
                or_(
                    Transaction.description.ilike(pattern),
                    Transaction.category_id.in_(matching_cat_ids),
                )
            )
        else:
            stmt = stmt.where(Transaction.description.ilike(pattern))

    stmt = stmt.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
    all_matching = list(await db.scalars(stmt))

    total_in = sum((t.amount for t in all_matching if t.type == "credit"), Decimal("0.00"))
    total_out = sum(
        (t.amount for t in all_matching if t.type in ("debit", "transfer")),
        Decimal("0.00"),
    )

    offset = (page - 1) * limit
    page_slice = all_matching[offset : offset + limit]
    serialized = [serialize_transaction(t, acct_map, cat_map) for t in page_slice]

    result = PaginatedTransactions(
        transactions=serialized,
        total=len(all_matching),
        page=page,
        limit=limit,
        total_in=total_in,
        total_out=-total_out if total_out > 0 else Decimal("0.00"),
    )
    await store.cache_set(cache_key, result.model_dump(mode="json"))
    return result


@router.post("/suggest-category", response_model=CategorySuggestionResponse)
async def suggest_category(
    payload: CategorySuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategorySuggestionResponse:
    cid, cname, conf = await suggest_category_for_text(
        db, current_user.id, payload.description, payload.type
    )
    return CategorySuggestionResponse(category_id=cid, category_name=cname, confidence=conf)


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionRead:
    acct_map, cat_map = await _load_maps(db, current_user.id)
    if payload.account_id not in acct_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    cat_id = payload.category_id
    if cat_id is None:
        suggested_id, _, _ = await suggest_category_for_text(
            db, current_user.id, payload.description, payload.type
        )
        if suggested_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No category provided and no categories exist yet",
            )
        cat_id = suggested_id
    elif cat_id not in cat_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    tx = Transaction(
        user_id=current_user.id,
        account_id=payload.account_id,
        category_id=cat_id,
        amount=payload.amount,
        transaction_date=payload.transaction_date,
        type=payload.type,
        description=payload.description.strip(),
        reference_no=payload.reference_no,
        is_reconciled=payload.is_reconciled,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    await store.invalidate_user_cache(str(current_user.id))
    return serialize_transaction(tx, acct_map, cat_map)


@router.get("/{tx_id}", response_model=TransactionRead)
async def get_transaction(
    tx_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionRead:
    tx = await db.scalar(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.user_id == current_user.id,
        )
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    acct_map, cat_map = await _load_maps(db, current_user.id)
    return serialize_transaction(tx, acct_map, cat_map)


@router.put("/{tx_id}", response_model=TransactionRead)
async def update_transaction(
    tx_id: uuid.UUID,
    payload: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionRead:
    tx = await db.scalar(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.user_id == current_user.id,
        )
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    acct_map, cat_map = await _load_maps(db, current_user.id)
    if payload.account_id is not None:
        if payload.account_id not in acct_map:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        tx.account_id = payload.account_id
    if payload.category_id is not None:
        if payload.category_id not in cat_map:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        tx.category_id = payload.category_id
    if payload.amount is not None:
        tx.amount = payload.amount
    if payload.transaction_date is not None:
        tx.transaction_date = payload.transaction_date
    if payload.type is not None:
        tx.type = payload.type
    if payload.description is not None:
        tx.description = payload.description.strip()
    if payload.reference_no is not None:
        tx.reference_no = payload.reference_no
    if payload.is_reconciled is not None:
        tx.is_reconciled = payload.is_reconciled

    await db.commit()
    await db.refresh(tx)
    await store.invalidate_user_cache(str(current_user.id))
    return serialize_transaction(tx, acct_map, cat_map)


@router.post("/{tx_id}/duplicate", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def duplicate_transaction(
    tx_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionRead:
    src = await db.scalar(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.user_id == current_user.id,
        )
    )
    if not src:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    copy_tx = Transaction(
        user_id=current_user.id,
        account_id=src.account_id,
        category_id=src.category_id,
        amount=src.amount,
        transaction_date=src.transaction_date,
        type=src.type,
        description=f"{src.description or 'Transaction'} (Copy)",
        is_reconciled=False,
    )
    db.add(copy_tx)
    await db.commit()
    await db.refresh(copy_tx)
    await store.invalidate_user_cache(str(current_user.id))
    acct_map, cat_map = await _load_maps(db, current_user.id)
    return serialize_transaction(copy_tx, acct_map, cat_map)


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    tx_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    tx = await db.scalar(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.user_id == current_user.id,
        )
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    await db.delete(tx)
    await db.commit()
    await store.invalidate_user_cache(str(current_user.id))
