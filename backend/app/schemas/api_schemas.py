import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class PreferencesSchema(BaseModel):
    theme: Literal["light", "dark", "system"] = "light"
    language: Literal["en", "pl", "fr"] = "en"
    currency: Literal["USD", "EUR", "GBP"] = "USD"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=100)
    username: Optional[str] = Field(default=None, max_length=50)
    seed_starter_categories: bool = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool
    preferences: PreferencesSchema
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    username: Optional[str] = Field(default=None, min_length=2, max_length=50)
    email: Optional[EmailStr] = None
    preferences: Optional[PreferencesSchema] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


# ---------- Accounts ----------
AccountTypeLiteral = Literal["checking", "savings", "credit", "investment", "cash"]


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    account_type: AccountTypeLiteral
    currency: str = Field(default="USD", min_length=3, max_length=3)
    opening_balance: Decimal = Decimal("0.00")

    @field_validator("currency")
    @classmethod
    def upper_currency(cls, v: str) -> str:
        return v.upper()


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    account_type: Optional[AccountTypeLiteral] = None
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    opening_balance: Optional[Decimal] = None
    is_active: Optional[bool] = None


class AccountMiniTx(BaseModel):
    id: uuid.UUID
    transaction_date: date
    description: Optional[str] = None
    type: str
    amount: Decimal
    signed_amount: Decimal


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    account_type: AccountTypeLiteral
    currency: str
    opening_balance: Decimal
    current_balance: Decimal
    money_in: Decimal = Decimal("0.00")
    money_out: Decimal = Decimal("0.00")
    is_active: bool
    recent_transactions: list[AccountMiniTx] = []


# ---------- Categories ----------
CategoryTypeLiteral = Literal["income", "expense", "transfer"]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: CategoryTypeLiteral
    color: str = Field(default="#0176d3", max_length=32)
    icon: Optional[str] = Field(default="tag", max_length=50)
    parent_id: Optional[uuid.UUID] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    type: Optional[CategoryTypeLiteral] = None
    color: Optional[str] = Field(default=None, max_length=32)
    icon: Optional[str] = Field(default=None, max_length=50)
    parent_id: Optional[uuid.UUID] = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    name: str
    type: CategoryTypeLiteral
    color: str
    icon: Optional[str] = None
    is_system: bool


# ---------- Transactions ----------
TxTypeLiteral = Literal["debit", "credit", "transfer"]


class TransactionCreate(BaseModel):
    account_id: uuid.UUID
    category_id: Optional[uuid.UUID] = None
    amount: Decimal = Field(gt=Decimal("0"))
    transaction_date: date
    type: TxTypeLiteral
    description: str = Field(min_length=1, max_length=500)
    reference_no: Optional[str] = Field(default=None, max_length=100)
    is_reconciled: bool = False


class TransactionUpdate(BaseModel):
    account_id: Optional[uuid.UUID] = None
    category_id: Optional[uuid.UUID] = None
    amount: Optional[Decimal] = Field(default=None, gt=Decimal("0"))
    transaction_date: Optional[date] = None
    type: Optional[TxTypeLiteral] = None
    description: Optional[str] = Field(default=None, min_length=1, max_length=500)
    reference_no: Optional[str] = Field(default=None, max_length=100)
    is_reconciled: Optional[bool] = None


class TransactionRead(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    account_name: str
    category_id: uuid.UUID
    category_name: str
    category_color: str
    user_id: uuid.UUID
    amount: Decimal
    signed_amount: Decimal
    transaction_date: date
    type: TxTypeLiteral
    description: Optional[str] = None
    reference_no: Optional[str] = None
    is_reconciled: bool
    created_at: datetime


class PaginatedTransactions(BaseModel):
    transactions: list[TransactionRead]
    total: int
    page: int
    limit: int
    total_in: Decimal
    total_out: Decimal


class CategorySuggestionRequest(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    type: TxTypeLiteral = "debit"


class CategorySuggestionResponse(BaseModel):
    category_id: Optional[uuid.UUID] = None
    category_name: Optional[str] = None
    confidence: float = 0.0


# ---------- Budgets ----------
BudgetPeriodLiteral = Literal["weekly", "monthly", "yearly"]


class BudgetCreate(BaseModel):
    category_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    amount_limit: Decimal = Field(gt=Decimal("0"))
    period: BudgetPeriodLiteral = "monthly"
    start_date: date
    end_date: date
    alert_threshold: Decimal = Field(default=Decimal("80.00"), gt=Decimal("0"), le=Decimal("100"))

    @field_validator("end_date")
    @classmethod
    def check_dates(cls, v: date, info) -> date:
        start = info.data.get("start_date")
        if start and v <= start:
            raise ValueError("end_date must be after start_date")
        return v


class BudgetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    amount_limit: Optional[Decimal] = Field(default=None, gt=Decimal("0"))
    period: Optional[BudgetPeriodLiteral] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    alert_threshold: Optional[Decimal] = Field(default=None, gt=Decimal("0"), le=Decimal("100"))


class BudgetUtilizationRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    category_id: uuid.UUID
    category_name: str
    category_color: str
    name: str
    amount_limit: Decimal
    period: BudgetPeriodLiteral
    start_date: date
    end_date: date
    alert_threshold: Decimal
    amount_spent: Decimal
    remaining_balance: Decimal
    pct_used: Decimal
    alert_triggered: bool
    over_budget: bool


# ---------- Dashboard, Reports, Notifications, CSV Import ----------
class TrendPoint(BaseModel):
    month: str
    income: Decimal
    expense: Decimal


class CategoryBreakdownItem(BaseModel):
    category_id: uuid.UUID
    label: str
    value: Decimal
    pct: float
    color: str


class DashboardSummary(BaseModel):
    reference_month: str
    net_worth: Decimal
    month_income: Decimal
    month_expense: Decimal
    savings_rate: int
    income_delta_pct: float
    expense_delta_pct: float
    net_worth_delta_pct: float
    trend: list[TrendPoint]
    breakdown: list[CategoryBreakdownItem]
    budgets: list[BudgetUtilizationRead]
    recent_transactions: list[TransactionRead]


class NotificationItem(BaseModel):
    id: str
    title: str
    body: str
    time: str
    kind: Literal["warn", "pos", "info"]


class ReportAnalyticsSummary(BaseModel):
    period_label: str
    start_date: date
    end_date: date
    total_income: Decimal
    total_expense: Decimal
    net_savings: Decimal
    transaction_count: int
    trend: list[TrendPoint]
    breakdown: list[CategoryBreakdownItem]


class ReportGenerateRequest(BaseModel):
    title: str = Field(default="Financial Summary Report", min_length=1, max_length=200)
    report_type: Literal["monthly", "custom", "annual"] = "custom"
    period_start: date
    period_end: date

    @field_validator("period_end")
    @classmethod
    def check_report_dates(cls, v: date, info) -> date:
        start = info.data.get("period_start")
        if start and v < start:
            raise ValueError("period_end must be on or after period_start")
        return v


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    report_type: str
    period_start: date
    period_end: date
    status: str
    generated_at: Optional[datetime] = None
    created_at: datetime


class CSVPreviewRow(BaseModel):
    row_number: int
    transaction_date: str
    description: str
    amount: Decimal
    type: TxTypeLiteral
    suggested_category_id: Optional[uuid.UUID] = None
    suggested_category_name: Optional[str] = None
    is_duplicate: bool = False


class CSVImportPreviewResponse(BaseModel):
    columns: list[str]
    detected_mapping: dict[str, str]
    sample_rows: list[CSVPreviewRow]
    total_rows: int


class CSVImportResult(BaseModel):
    imported_count: int
    skipped_duplicates: int
    errors: list[str] = []
