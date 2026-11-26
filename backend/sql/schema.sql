-- =============================================================================
-- FinanceTracker / FinanceTrace — PostgreSQL 16 Relational Schema (BCNF)
-- Reconciles Stage 5 Logical Schema, Architecture Report, and React Prototype
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared trigger function for automatic updated_at audit trail
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    username VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    preferences JSONB NOT NULL DEFAULT '{"theme": "light", "language": "en", "currency": "USD"}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_username UNIQUE (username)
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. ACCOUNTS
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL
        CHECK (account_type IN ('checking', 'savings', 'credit', 'investment', 'cash')),
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_accounts_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_accounts_user ON accounts(user_id);

CREATE TRIGGER trg_accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. CATEGORIES (Hierarchical via self-referencing parent_id)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    parent_id UUID,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL
        CHECK (type IN ('income', 'expense', 'transfer')),
    color VARCHAR(32) NOT NULL DEFAULT '#0176d3',
    icon VARCHAR(50),
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_categories_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_categories_parent
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT uq_category_user_name UNIQUE (user_id, name)
);

CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. TRANSACTIONS (Immutable ledger rules via ON DELETE RESTRICT)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    category_id UUID NOT NULL,
    user_id UUID NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    transaction_date DATE NOT NULL,
    type VARCHAR(10) NOT NULL
        CHECK (type IN ('debit', 'credit', 'transfer')),
    description TEXT,
    reference_no VARCHAR(100),
    is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_txn_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_txn_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    CONSTRAINT fk_txn_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_txn_account ON transactions(account_id);
CREATE INDEX idx_txn_category ON transactions(category_id);
CREATE INDEX idx_txn_user_date ON transactions(user_id, transaction_date DESC);

CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. BUDGETS
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    amount_limit DECIMAL(15,2) NOT NULL CHECK (amount_limit > 0),
    period VARCHAR(10) NOT NULL
        CHECK (period IN ('weekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    alert_threshold DECIMAL(5,2) NOT NULL DEFAULT 80.00
        CHECK (alert_threshold > 0 AND alert_threshold <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_budgets_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_budgets_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    CONSTRAINT chk_budget_dates CHECK (end_date > start_date),
    CONSTRAINT uq_budget_period UNIQUE (user_id, category_id, start_date)
);

CREATE INDEX idx_budgets_user ON budgets(user_id);
CREATE INDEX idx_budgets_category ON budgets(category_id);

CREATE TRIGGER trg_budgets_updated_at
BEFORE UPDATE ON budgets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. REPORTS
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    report_type VARCHAR(10) NOT NULL
        CHECK (report_type IN ('monthly', 'custom', 'annual')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    file_path TEXT,
    status VARCHAR(12) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed')),
    generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_reports_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_report_dates CHECK (period_end >= period_start)
);

CREATE INDEX idx_reports_user ON reports(user_id);

CREATE TRIGGER trg_reports_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. LOGICAL VIEW: budget_utilization (real-time remaining balance & threshold alerts)
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
