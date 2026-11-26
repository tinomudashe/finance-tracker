export type RouteId =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "budgets"
  | "reports"
  | "settings";

export interface Preferences {
  theme: "light" | "dark" | "system";
  language: "en" | "pl" | "fr";
  currency: "USD" | "EUR" | "GBP";
}

export interface User {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  is_active: boolean;
  preferences: Preferences;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type AccountType = "checking" | "savings" | "credit" | "investment" | "cash";

export interface AccountMiniTx {
  id: string;
  transaction_date: string;
  description: string | null;
  type: string;
  amount: string | number;
  signed_amount: string | number;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  currency: string;
  opening_balance: string | number;
  current_balance: string | number;
  money_in: string | number;
  money_out: string | number;
  is_active: boolean;
  recent_transactions: AccountMiniTx[];
}

export type CategoryType = "income" | "expense" | "transfer";

export interface Category {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  type: CategoryType;
  color: string;
  icon: string | null;
  is_system: boolean;
}

export type TxType = "debit" | "credit" | "transfer";

export interface Transaction {
  id: string;
  account_id: string;
  account_name: string;
  category_id: string;
  category_name: string;
  category_color: string;
  user_id: string;
  amount: string | number;
  signed_amount: string | number;
  transaction_date: string;
  type: TxType;
  description: string | null;
  reference_no: string | null;
  is_reconciled: boolean;
  created_at: string;
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
  total_in: string | number;
  total_out: string | number;
}

export interface BudgetUtilization {
  id: string;
  user_id: string;
  category_id: string;
  category_name: string;
  category_color: string;
  name: string;
  amount_limit: string | number;
  period: "weekly" | "monthly" | "yearly";
  start_date: string;
  end_date: string;
  alert_threshold: string | number;
  amount_spent: string | number;
  remaining_balance: string | number;
  pct_used: string | number;
  alert_triggered: boolean;
  over_budget: boolean;
}

export interface TrendPoint {
  month: string;
  income: string | number;
  expense: string | number;
}

export interface CategoryBreakdownItem {
  category_id: string;
  label: string;
  value: string | number;
  pct: number;
  color: string;
}

export interface DashboardSummary {
  reference_month: string;
  net_worth: string | number;
  month_income: string | number;
  month_expense: string | number;
  savings_rate: number;
  income_delta_pct: number;
  expense_delta_pct: number;
  net_worth_delta_pct: number;
  trend: TrendPoint[];
  breakdown: CategoryBreakdownItem[];
  budgets: BudgetUtilization[];
  recent_transactions: Transaction[];
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  kind: "warn" | "pos" | "info";
}

export interface ReportAnalyticsSummary {
  period_label: string;
  start_date: string;
  end_date: string;
  total_income: string | number;
  total_expense: string | number;
  net_savings: string | number;
  transaction_count: number;
  trend: TrendPoint[];
  breakdown: CategoryBreakdownItem[];
}

export interface ReportRecord {
  id: string;
  user_id: string;
  title: string;
  report_type: string;
  period_start: string;
  period_end: string;
  status: string;
  generated_at: string | null;
  created_at: string;
}

export interface CSVPreviewRow {
  row_number: number;
  transaction_date: string;
  description: string;
  amount: string | number;
  type: TxType;
  suggested_category_id: string | null;
  suggested_category_name: string | null;
  is_duplicate: boolean;
}

export interface CSVImportPreviewResponse {
  columns: string[];
  detected_mapping: Record<string, string>;
  sample_rows: CSVPreviewRow[];
  total_rows: number;
}
