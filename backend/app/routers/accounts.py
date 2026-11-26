import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import store
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Account, Transaction, User
from app.schemas import AccountCreate, AccountRead, AccountUpdate
from app.services.ledger import build_accounts_with_balances

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountRead])
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AccountRead]:
    return await build_accounts_with_balances(db, current_user.id)


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountRead:
    acct = Account(
        user_id=current_user.id,
        name=payload.name.strip(),
        account_type=payload.account_type,
        currency=payload.currency.upper(),
        opening_balance=payload.opening_balance,
    )
    db.add(acct)
    await db.commit()
    await store.invalidate_user_cache(str(current_user.id))
    accounts = await build_accounts_with_balances(db, current_user.id)
    return next(a for a in accounts if a.id == acct.id)


@router.get("/{account_id}", response_model=AccountRead)
async def get_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountRead:
    accounts = await build_accounts_with_balances(db, current_user.id)
    found = next((a for a in accounts if a.id == account_id), None)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return found


@router.put("/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountRead:
    acct = await db.scalar(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    if not acct:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if payload.name is not None:
        acct.name = payload.name.strip()
    if payload.account_type is not None:
        acct.account_type = payload.account_type
    if payload.currency is not None:
        acct.currency = payload.currency.upper()
    if payload.opening_balance is not None:
        acct.opening_balance = payload.opening_balance
    if payload.is_active is not None:
        acct.is_active = payload.is_active

    await db.commit()
    await store.invalidate_user_cache(str(current_user.id))
    accounts = await build_accounts_with_balances(db, current_user.id)
    return next(a for a in accounts if a.id == account_id)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    acct = await db.scalar(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    if not acct:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    tx_count = await db.scalar(
        select(func.count()).select_from(Transaction).where(Transaction.account_id == account_id)
    )
    if tx_count and tx_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete an account that has historical transactions (ON DELETE RESTRICT).",
        )

    try:
        await db.delete(acct)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account is referenced by ledger records and cannot be deleted.",
        ) from exc

    await store.invalidate_user_cache(str(current_user.id))
