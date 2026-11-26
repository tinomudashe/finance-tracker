"""Initial BCNF PostgreSQL schema

Revision ID: 0001_initial_schema
Revises: None
Create Date: 2026-11-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"
    json_type = postgresql.JSONB(astext_type=sa.Text()) if is_pg else sa.JSON()

    if is_pg:
        op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
        op.execute(
            """
            CREATE OR REPLACE FUNCTION set_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = now();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            """
        )

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("username", sa.String(50), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("preferences", json_type, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )

    op.create_table(
        "accounts",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("account_type", sa.String(20), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("opening_balance", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_accounts_user", ondelete="RESTRICT"),
        sa.CheckConstraint(
            "account_type IN ('checking', 'savings', 'credit', 'investment', 'cash')",
            name="chk_account_type",
        ),
    )
    op.create_index("idx_accounts_user", "accounts", ["user_id"])

    op.create_table(
        "categories",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("parent_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("color", sa.String(32), nullable=False, server_default="#0176d3"),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_categories_user", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["parent_id"], ["categories.id"], name="fk_categories_parent", ondelete="SET NULL"),
        sa.UniqueConstraint("user_id", "name", name="uq_category_user_name"),
        sa.CheckConstraint("type IN ('income', 'expense', 'transfer')", name="chk_category_type"),
    )
    op.create_index("idx_categories_user", "categories", ["user_id"])
    op.create_index("idx_categories_parent", "categories", ["parent_id"])

    op.create_table(
        "transactions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("account_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("category_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("reference_no", sa.String(100), nullable=True),
        sa.Column("is_reconciled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], name="fk_txn_account", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name="fk_txn_category", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_txn_user", ondelete="RESTRICT"),
        sa.CheckConstraint("amount > 0", name="chk_txn_amount_positive"),
        sa.CheckConstraint("type IN ('debit', 'credit', 'transfer')", name="chk_txn_type"),
    )
    op.create_index("idx_txn_account", "transactions", ["account_id"])
    op.create_index("idx_txn_category", "transactions", ["category_id"])
    op.create_index("idx_txn_user_date", "transactions", ["user_id", "transaction_date"])

    op.create_table(
        "budgets",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("category_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("amount_limit", sa.Numeric(15, 2), nullable=False),
        sa.Column("period", sa.String(10), nullable=False, server_default="monthly"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("alert_threshold", sa.Numeric(5, 2), nullable=False, server_default="80.00"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_budgets_user", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name="fk_budgets_category", ondelete="RESTRICT"),
        sa.UniqueConstraint("user_id", "category_id", "start_date", name="uq_budget_period"),
        sa.CheckConstraint("amount_limit > 0", name="chk_budget_limit_positive"),
        sa.CheckConstraint("period IN ('weekly', 'monthly', 'yearly')", name="chk_budget_period"),
        sa.CheckConstraint("end_date > start_date", name="chk_budget_dates"),
        sa.CheckConstraint("alert_threshold > 0 AND alert_threshold <= 100", name="chk_budget_threshold"),
    )
    op.create_index("idx_budgets_user", "budgets", ["user_id"])
    op.create_index("idx_budgets_category", "budgets", ["category_id"])

    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("report_type", sa.String(10), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("status", sa.String(12), nullable=False, server_default="pending"),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_reports_user", ondelete="CASCADE"),
        sa.CheckConstraint("report_type IN ('monthly', 'custom', 'annual')", name="chk_report_type"),
        sa.CheckConstraint("status IN ('pending', 'completed', 'failed')", name="chk_report_status"),
        sa.CheckConstraint("period_end >= period_start", name="chk_report_dates"),
    )
    op.create_index("idx_reports_user", "reports", ["user_id"])

    if is_pg:
        for tbl in ("users", "accounts", "categories", "transactions", "budgets", "reports"):
            op.execute(
                f"CREATE TRIGGER trg_{tbl}_updated_at BEFORE UPDATE ON {tbl} "
                f"FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
            )


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        for tbl in ("reports", "budgets", "transactions", "categories", "accounts", "users"):
            op.execute(f"DROP TRIGGER IF EXISTS trg_{tbl}_updated_at ON {tbl};")

    op.drop_index("idx_reports_user", table_name="reports")
    op.drop_table("reports")

    op.drop_index("idx_budgets_category", table_name="budgets")
    op.drop_index("idx_budgets_user", table_name="budgets")
    op.drop_table("budgets")

    op.drop_index("idx_txn_user_date", table_name="transactions")
    op.drop_index("idx_txn_category", table_name="transactions")
    op.drop_index("idx_txn_account", table_name="transactions")
    op.drop_table("transactions")

    op.drop_index("idx_categories_parent", table_name="categories")
    op.drop_index("idx_categories_user", table_name="categories")
    op.drop_table("categories")

    op.drop_index("idx_accounts_user", table_name="accounts")
    op.drop_table("accounts")

    op.drop_table("users")

    if is_pg:
        op.execute("DROP FUNCTION IF EXISTS set_updated_at();")
