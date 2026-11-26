"""Create budget_utilization logical view

Revision ID: 0002_budget_utilization_view
Revises: 0001_initial_schema
Create Date: 2026-11-25
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002_budget_utilization_view"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            """
            CREATE OR REPLACE VIEW budget_utilization AS
            SELECT
                b.id,
                b.user_id,
                b.category_id,
                c.name AS category_name,
                c.color AS category_color,
                b.name,
                b.amount_limit,
                b.period,
                b.start_date,
                b.end_date,
                b.alert_threshold,
                COALESCE(SUM(t.amount), 0.00)::DECIMAL(15,2) AS amount_spent,
                (b.amount_limit - COALESCE(SUM(t.amount), 0.00))::DECIMAL(15,2) AS remaining_balance,
                ROUND(
                    COALESCE(SUM(t.amount), 0.00) / NULLIF(b.amount_limit, 0) * 100,
                    2
                ) AS pct_used,
                CASE
                    WHEN COALESCE(SUM(t.amount), 0.00) / NULLIF(b.amount_limit, 0) * 100 >= b.alert_threshold
                    THEN TRUE ELSE FALSE
                END AS alert_triggered,
                CASE
                    WHEN COALESCE(SUM(t.amount), 0.00) > b.amount_limit
                    THEN TRUE ELSE FALSE
                END AS over_budget
            FROM budgets b
            JOIN categories c ON c.id = b.category_id
            LEFT JOIN transactions t
                ON t.category_id = b.category_id
                AND t.user_id = b.user_id
                AND t.transaction_date BETWEEN b.start_date AND b.end_date
                AND t.type = 'debit'
            GROUP BY
                b.id, b.user_id, b.category_id, c.name, c.color,
                b.name, b.amount_limit, b.period, b.start_date, b.end_date, b.alert_threshold;
            """
        )
    else:
        op.execute(
            """
            CREATE VIEW IF NOT EXISTS budget_utilization AS
            SELECT
                b.id,
                b.user_id,
                b.category_id,
                c.name AS category_name,
                c.color AS category_color,
                b.name,
                b.amount_limit,
                b.period,
                b.start_date,
                b.end_date,
                b.alert_threshold,
                COALESCE(SUM(t.amount), 0.0) AS amount_spent,
                (b.amount_limit - COALESCE(SUM(t.amount), 0.0)) AS remaining_balance,
                ROUND(
                    CAST(COALESCE(SUM(t.amount), 0.0) AS FLOAT) / NULLIF(b.amount_limit, 0) * 100.0,
                    2
                ) AS pct_used,
                CASE
                    WHEN (CAST(COALESCE(SUM(t.amount), 0.0) AS FLOAT) / NULLIF(b.amount_limit, 0) * 100.0) >= b.alert_threshold
                    THEN 1 ELSE 0
                END AS alert_triggered,
                CASE
                    WHEN COALESCE(SUM(t.amount), 0.0) > b.amount_limit
                    THEN 1 ELSE 0
                END AS over_budget
            FROM budgets b
            JOIN categories c ON c.id = b.category_id
            LEFT JOIN transactions t
                ON t.category_id = b.category_id
                AND t.user_id = b.user_id
                AND t.transaction_date BETWEEN b.start_date AND b.end_date
                AND t.type = 'debit'
            GROUP BY
                b.id, b.user_id, b.category_id, c.name, c.color,
                b.name, b.amount_limit, b.period, b.start_date, b.end_date, b.alert_threshold;
            """
        )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS budget_utilization;")
