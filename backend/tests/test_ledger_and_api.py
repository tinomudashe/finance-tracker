from io import BytesIO
from pathlib import Path

from alembic.config import Config
from httpx import AsyncClient
from openpyxl import load_workbook

from alembic import command
from app.core.config import settings


async def test_full_financial_workflow_and_integrity_rules(client: AsyncClient) -> None:
    # Seed & sign in via demo workspace (Daniel Brooks)
    demo = await client.post("/api/auth/demo")
    assert demo.status_code == 200
    headers = {"Authorization": f"Bearer {demo.json()['access_token']}"}

    # 1. Accounts CRUD + ON DELETE RESTRICT enforcement
    accts_res = await client.get("/api/accounts", headers=headers)
    assert accts_res.status_code == 200
    accts = accts_res.json()
    assert len(accts) == 5
    checking = next(a for a in accts if a["account_type"] == "checking")
    cash = next(a for a in accts if a["account_type"] == "cash")
    assert cash["name"] == "Cash Wallet"

    # Deleting an account that has historical transactions MUST fail with 409 Conflict
    del_restricted = await client.delete(f"/api/accounts/{checking['id']}", headers=headers)
    assert del_restricted.status_code == 409

    # Creating, updating, and deleting an empty account succeeds
    new_acct = await client.post(
        "/api/accounts",
        headers=headers,
        json={
            "name": "Emergency Vault",
            "account_type": "savings",
            "currency": "eur",
            "opening_balance": 1500.00,
        },
    )
    assert new_acct.status_code == 201
    vault_id = new_acct.json()["id"]
    assert new_acct.json()["currency"] == "EUR"
    assert float(new_acct.json()["current_balance"]) == 1500.00

    upd_acct = await client.put(
        f"/api/accounts/{vault_id}",
        headers=headers,
        json={"name": "Updated Vault", "opening_balance": 2000.00},
    )
    assert upd_acct.status_code == 200
    assert float(upd_acct.json()["current_balance"]) == 2000.00

    del_empty = await client.delete(f"/api/accounts/{vault_id}", headers=headers)
    assert del_empty.status_code == 204

    # 2. Categories CRUD + hierarchy + ON DELETE RESTRICT
    cats = (await client.get("/api/categories", headers=headers)).json()
    groceries = next(c for c in cats if c["name"] == "Groceries")

    del_cat_restricted = await client.delete(f"/api/categories/{groceries['id']}", headers=headers)
    assert del_cat_restricted.status_code == 409

    parent_cat = await client.post(
        "/api/categories",
        headers=headers,
        json={"name": "Travel", "type": "expense", "color": "#1b96ff"},
    )
    assert parent_cat.status_code == 201
    pid = parent_cat.json()["id"]

    child_cat = await client.post(
        "/api/categories",
        headers=headers,
        json={"name": "Flights", "type": "expense", "color": "#0176d3", "parent_id": pid},
    )
    assert child_cat.status_code == 201
    cid = child_cat.json()["id"]

    # Deleting parent sets child's parent_id to NULL cleanly
    assert (await client.delete(f"/api/categories/{pid}", headers=headers)).status_code == 204
    cats_after = (await client.get("/api/categories", headers=headers)).json()
    flights = next(c for c in cats_after if c["id"] == cid)
    assert flights["parent_id"] is None

    # 3. Transactions CRUD, search, TF-IDF auto-categorization, duplicate
    sug = await client.post(
        "/api/transactions/suggest-category",
        headers=headers,
        json={"description": "Weekly groceries at FreshMart", "type": "debit"},
    )
    assert sug.status_code == 200
    assert sug.json()["category_name"] == "Groceries"

    # Create transaction WITHOUT category_id (auto-categorized!)
    created_tx = await client.post(
        "/api/transactions",
        headers=headers,
        json={
            "account_id": checking["id"],
            "amount": 55.25,
            "transaction_date": "2026-05-29",
            "type": "debit",
            "description": "FreshMart organic groceries",
        },
    )
    assert created_tx.status_code == 201
    tx_id = created_tx.json()["id"]
    assert created_tx.json()["category_name"] == "Groceries"
    assert float(created_tx.json()["signed_amount"]) == -55.25

    # Update & duplicate transaction
    upd_tx = await client.put(
        f"/api/transactions/{tx_id}",
        headers=headers,
        json={"amount": 60.00, "description": "FreshMart groceries updated"},
    )
    assert upd_tx.status_code == 200
    assert float(upd_tx.json()["amount"]) == 60.00

    dup_tx = await client.post(f"/api/transactions/{tx_id}/duplicate", headers=headers)
    assert dup_tx.status_code == 201
    dup_id = dup_tx.json()["id"]
    assert "(Copy)" in dup_tx.json()["description"]

    # Search & filter transactions (hits cache on repeat call)
    tx_list_1 = await client.get("/api/transactions?q=FreshMart&type=expense", headers=headers)
    tx_list_2 = await client.get("/api/transactions?q=FreshMart&type=expense", headers=headers)
    assert tx_list_1.status_code == 200
    assert tx_list_1.json()["total"] == tx_list_2.json()["total"]
    assert tx_list_1.json()["total"] >= 2

    assert (await client.delete(f"/api/transactions/{dup_id}", headers=headers)).status_code == 204
    assert (await client.delete(f"/api/transactions/{tx_id}", headers=headers)).status_code == 204

    # 4. Budgets & Dashboard & Notifications
    budgets = (await client.get("/api/budgets", headers=headers)).json()
    dining_budget = next(b for b in budgets if b["category_name"] == "Dining")
    assert dining_budget["over_budget"] is True
    assert dining_budget["alert_triggered"] is True

    new_budget = await client.post(
        "/api/budgets",
        headers=headers,
        json={
            "category_id": cid,
            "name": "Flights June Budget",
            "amount_limit": 800.00,
            "period": "monthly",
            "start_date": "2026-06-01",
            "end_date": "2026-06-30",
        },
    )
    assert new_budget.status_code == 201
    bid = new_budget.json()["id"]
    assert (
        await client.put(f"/api/budgets/{bid}", headers=headers, json={"amount_limit": 950.00})
    ).status_code == 200
    assert (await client.delete(f"/api/budgets/{bid}", headers=headers)).status_code == 204

    dash = await client.get("/api/dashboard/summary", headers=headers)
    assert dash.status_code == 200
    assert len(dash.json()["trend"]) == 6
    assert len(dash.json()["breakdown"]) >= 5

    notifs = await client.get("/api/notifications", headers=headers)
    assert notifs.status_code == 200
    assert any("Dining" in n["title"] for n in notifs.json())

    # 5. Reports: Analytics, Excel (.xlsx) export, and PDF generation/download
    rep_an = await client.get("/api/reports/analytics?period=3m", headers=headers)
    assert rep_an.status_code == 200
    assert rep_an.json()["transaction_count"] > 0

    xlsx_res = await client.get("/api/reports/export.xlsx?period=3m", headers=headers)
    assert xlsx_res.status_code == 200
    wb = load_workbook(BytesIO(xlsx_res.content))
    assert "Summary" in wb.sheetnames
    assert "Transactions" in wb.sheetnames

    pdf_gen = await client.post(
        "/api/reports/generate",
        headers=headers,
        json={
            "title": "May 2026 Audit",
            "report_type": "monthly",
            "period_start": "2026-05-01",
            "period_end": "2026-05-31",
        },
    )
    assert pdf_gen.status_code == 201
    rep_id = pdf_gen.json()["id"]
    assert pdf_gen.json()["status"] == "completed"

    pdf_dl = await client.get(f"/api/reports/{rep_id}/download", headers=headers)
    assert pdf_dl.status_code == 200
    assert pdf_dl.content.startswith(b"%PDF")

    # 6. CSV Bank Statement Preview & Import (with duplicate detection)
    csv_body = (
        "Date,Description,Amount\n"
        "2026-05-30,FreshMart Supermarket,-74.50\n"
        "2026-05-30,Freelance Consulting Payout,650.00\n"
    )
    prev = await client.post(
        "/api/import/csv/preview",
        headers=headers,
        files={"file": ("statement.csv", csv_body.encode("utf-8"), "text/csv")},
        data={"account_id": checking["id"]},
    )
    assert prev.status_code == 200
    assert prev.json()["total_rows"] == 2

    imp1 = await client.post(
        "/api/import/csv",
        headers=headers,
        files={"file": ("statement.csv", csv_body.encode("utf-8"), "text/csv")},
        data={"account_id": checking["id"]},
    )
    assert imp1.status_code == 201
    assert imp1.json()["imported_count"] == 2
    assert imp1.json()["skipped_duplicates"] == 0

    imp2 = await client.post(
        "/api/import/csv",
        headers=headers,
        files={"file": ("statement.csv", csv_body.encode("utf-8"), "text/csv")},
        data={"account_id": checking["id"]},
    )
    assert imp2.status_code == 201
    assert imp2.json()["imported_count"] == 0
    assert imp2.json()["skipped_duplicates"] == 2

    # 7. Multi-user data isolation: User B cannot access Daniel's accounts or transactions
    reg_b = await client.post(
        "/api/auth/register",
        json={
            "email": "bob@example.com",
            "password": "BobPassword123!",
            "full_name": "Bob Isolated",
        },
    )
    headers_b = {"Authorization": f"Bearer {reg_b.json()['access_token']}"}
    bob_accts = (await client.get("/api/accounts", headers=headers_b)).json()
    assert bob_accts == []
    forbidden_acct = await client.get(f"/api/accounts/{checking['id']}", headers=headers_b)
    assert forbidden_acct.status_code == 404


def test_alembic_upgrade_and_downgrade_cycle(tmp_path: Path, monkeypatch) -> None:
    mig_db = f"sqlite+aiosqlite:///{tmp_path}/alembic_cycle.db"
    monkeypatch.setattr(settings, "DATABASE_URL", mig_db)
    backend_dir = Path(__file__).resolve().parents[1]
    cfg = Config(str(backend_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))

    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
