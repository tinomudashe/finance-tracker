import csv
import hashlib
import io
import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import store
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Account, Category, Transaction, User
from app.schemas import CSVImportPreviewResponse, CSVImportResult, CSVPreviewRow
from app.services.categorizer import suggest_category_for_text

router = APIRouter(prefix="/import", tags=["csv-import"])


def _detect_columns(headers: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for h in headers:
        hl = h.strip().lower()
        if "date" in hl and "date" not in mapping:
            mapping["date"] = h
        elif hl in ("description", "desc", "memo", "payee", "merchant", "narration") and "description" not in mapping:
            mapping["description"] = h
        elif "amount" in hl and "amount" not in mapping:
            mapping["amount"] = h
        elif hl in ("type", "direction", "kind") and "type" not in mapping:
            mapping["type"] = h
        elif "category" in hl and "category" not in mapping:
            mapping["category"] = h
    if "date" not in mapping and headers:
        mapping["date"] = headers[0]
    if "description" not in mapping and len(headers) > 1:
        mapping["description"] = headers[1]
    if "amount" not in mapping and len(headers) > 2:
        mapping["amount"] = headers[2]
    return mapping


def _parse_date(raw: str) -> date:
    val = raw.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return date.fromisoformat(val)


def _row_ref_hash(account_id: uuid.UUID, tdate: date, desc: str, amt: Decimal, ttype: str) -> str:
    raw = f"csv:{account_id}:{tdate.isoformat()}:{desc.strip().lower()}:{amt:.2f}:{ttype}"
    return "csv_" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


@router.post("/csv/preview", response_model=CSVImportPreviewResponse)
async def preview_csv_import(
    file: UploadFile = File(...),
    account_id: Optional[uuid.UUID] = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CSVImportPreviewResponse:
    content = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(content))
    headers = list(reader.fieldnames or [])
    if not headers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file has no header row")

    mapping = _detect_columns(headers)
    existing_refs = set(
        await db.scalars(
            select(Transaction.reference_no).where(
                Transaction.user_id == current_user.id,
                Transaction.reference_no.is_not(None),
            )
        )
    )

    all_rows = list(reader)
    sample: list[CSVPreviewRow] = []
    for idx, row in enumerate(all_rows[:15], start=1):
        raw_date = (row.get(mapping.get("date", ""), "") or "").strip()
        raw_desc = (row.get(mapping.get("description", ""), "") or "").strip() or "Imported transaction"
        raw_amt = (row.get(mapping.get("amount", ""), "0") or "0").replace("$", "").replace(",", "").strip()
        raw_type = (row.get(mapping.get("type", ""), "") or "").strip().lower()

        try:
            parsed_amt = Decimal(raw_amt)
        except InvalidOperation:
            continue
        if parsed_amt == 0:
            continue

        if raw_type in ("credit", "income"):
            tx_type = "credit"
        elif raw_type in ("transfer",):
            tx_type = "transfer"
        elif raw_type in ("debit", "expense"):
            tx_type = "debit"
        else:
            tx_type = "credit" if parsed_amt > 0 else "debit"

        abs_amt = abs(parsed_amt).quantize(Decimal("0.01"))
        try:
            tdate = _parse_date(raw_date)
        except ValueError:
            tdate = date.today()

        cid, cname, _ = await suggest_category_for_text(db, current_user.id, raw_desc, tx_type)
        is_dup = False
        if account_id:
            ref = _row_ref_hash(account_id, tdate, raw_desc, abs_amt, tx_type)
            is_dup = ref in existing_refs

        sample.append(
            CSVPreviewRow(
                row_number=idx,
                transaction_date=tdate.isoformat(),
                description=raw_desc,
                amount=abs_amt,
                type=tx_type,  # type: ignore[arg-type]
                suggested_category_id=cid,
                suggested_category_name=cname,
                is_duplicate=is_dup,
            )
        )

    return CSVImportPreviewResponse(
        columns=headers,
        detected_mapping=mapping,
        sample_rows=sample,
        total_rows=len(all_rows),
    )


@router.post("/csv", response_model=CSVImportResult, status_code=status.HTTP_201_CREATED)
async def commit_csv_import(
    file: UploadFile = File(...),
    account_id: uuid.UUID = Form(...),
    date_column: Optional[str] = Form(default=None),
    description_column: Optional[str] = Form(default=None),
    amount_column: Optional[str] = Form(default=None),
    type_column: Optional[str] = Form(default=None),
    category_column: Optional[str] = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CSVImportResult:
    acct = await db.scalar(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    if not acct:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target account not found")

    content = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(content))
    headers = list(reader.fieldnames or [])
    if not headers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty CSV file")

    detected = _detect_columns(headers)
    col_date = date_column or detected.get("date", "")
    col_desc = description_column or detected.get("description", "")
    col_amt = amount_column or detected.get("amount", "")
    col_type = type_column or detected.get("type", "")
    col_cat = category_column or detected.get("category", "")

    cats_by_name = {
        c.name.lower(): c
        for c in await db.scalars(select(Category).where(Category.user_id == current_user.id))
    }
    existing_refs = set(
        await db.scalars(
            select(Transaction.reference_no).where(
                Transaction.user_id == current_user.id,
                Transaction.reference_no.is_not(None),
            )
        )
    )

    imported = 0
    skipped = 0
    errors: list[str] = []

    for idx, row in enumerate(reader, start=1):
        try:
            tdate = _parse_date(row.get(col_date, "") or "")
            desc = (row.get(col_desc, "") or "").strip() or f"Imported Row {idx}"
            raw_amt = (row.get(col_amt, "") or "").replace("$", "").replace(",", "").strip()
            parsed_amt = Decimal(raw_amt)
            if parsed_amt == 0:
                continue
        except (ValueError, InvalidOperation) as exc:
            errors.append(f"Row {idx}: {exc}")
            continue

        raw_type = (row.get(col_type, "") or "").strip().lower() if col_type else ""
        if raw_type in ("credit", "income"):
            tx_type = "credit"
        elif raw_type == "transfer":
            tx_type = "transfer"
        elif raw_type in ("debit", "expense"):
            tx_type = "debit"
        else:
            tx_type = "credit" if parsed_amt > 0 else "debit"

        abs_amt = abs(parsed_amt).quantize(Decimal("0.01"))
        ref = _row_ref_hash(account_id, tdate, desc, abs_amt, tx_type)
        if ref in existing_refs:
            skipped += 1
            continue

        explicit_cat_name = (row.get(col_cat, "") or "").strip().lower() if col_cat else ""
        if explicit_cat_name and explicit_cat_name in cats_by_name:
            cat_id = cats_by_name[explicit_cat_name].id
        else:
            cat_id, _, _ = await suggest_category_for_text(db, current_user.id, desc, tx_type)

        if cat_id is None:
            errors.append(f"Row {idx}: no matching category available")
            continue

        db.add(
            Transaction(
                user_id=current_user.id,
                account_id=account_id,
                category_id=cat_id,
                amount=abs_amt,
                transaction_date=tdate,
                type=tx_type,
                description=desc,
                reference_no=ref,
                is_reconciled=False,
            )
        )
        existing_refs.add(ref)
        imported += 1

    await db.commit()
    await store.invalidate_user_cache(str(current_user.id))
    return CSVImportResult(imported_count=imported, skipped_duplicates=skipped, errors=errors)
