import type {
  Account,
  AuthResponse,
  BudgetUtilization,
  Category,
  CSVImportPreviewResponse,
  DashboardSummary,
  NotificationItem,
  PaginatedTransactions,
  Preferences,
  ReportAnalyticsSummary,
  ReportRecord,
  Transaction,
  TxType,
  User,
} from "../types";

let accessToken: string | null = localStorage.getItem("ft_token");

export function setAccessToken(tok: string | null): void {
  accessToken = tok;
  if (tok) localStorage.setItem("ft_token", tok);
  else localStorage.removeItem("ft_token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (!(init.body instanceof FormData) && init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const detail =
      typeof body === "object" && body && "detail" in body
        ? typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail)
        : `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return body as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<AuthResponse> {
    const out = await request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(out.access_token);
    return out;
  },
  async register(email: string, password: string, full_name: string, username?: string): Promise<AuthResponse> {
    const out = await request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name, username }),
    });
    setAccessToken(out.access_token);
    return out;
  },
  async demoLogin(): Promise<AuthResponse> {
    const out = await request<AuthResponse>("/api/auth/demo", { method: "POST" });
    setAccessToken(out.access_token);
    return out;
  },
  async logout(): Promise<void> {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
    }
  },
  me: () => request<User>("/api/auth/me"),
  updateProfile: (payload: {
    full_name?: string;
    username?: string;
    email?: string;
    preferences?: Preferences;
  }) =>
    request<User>("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Dashboard & Notifications
  getDashboard: () => request<DashboardSummary>("/api/dashboard/summary"),
  getNotifications: () => request<NotificationItem[]>("/api/notifications"),

  // Accounts
  listAccounts: () => request<Account[]>("/api/accounts"),
  createAccount: (payload: {
    name: string;
    account_type: Account["account_type"];
    currency: string;
    opening_balance: number;
  }) =>
    request<Account>("/api/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAccount: (
    id: string,
    payload: Partial<{
      name: string;
      account_type: Account["account_type"];
      currency: string;
      opening_balance: number;
    }>
  ) =>
    request<Account>(`/api/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteAccount: (id: string) =>
    request<void>(`/api/accounts/${id}`, { method: "DELETE" }),

  // Categories
  listCategories: () => request<Category[]>("/api/categories"),
  createCategory: (payload: {
    name: string;
    type: Category["type"];
    color: string;
    parent_id?: string | null;
  }) =>
    request<Category>("/api/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCategory: (
    id: string,
    payload: Partial<{ name: string; type: Category["type"]; color: string }>
  ) =>
    request<Category>(`/api/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteCategory: (id: string) =>
    request<void>(`/api/categories/${id}`, { method: "DELETE" }),

  // Transactions
  listTransactions: (params: {
    q?: string;
    type?: string;
    account_id?: string;
    category_id?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== "all") sp.set(k, String(v));
    });
    const qs = sp.toString();
    return request<PaginatedTransactions>(`/api/transactions${qs ? "?" + qs : ""}`);
  },
  createTransaction: (payload: {
    account_id: string;
    category_id?: string | null;
    amount: number;
    transaction_date: string;
    type: TxType;
    description: string;
  }) =>
    request<Transaction>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTransaction: (
    id: string,
    payload: Partial<{
      account_id: string;
      category_id: string;
      amount: number;
      transaction_date: string;
      type: TxType;
      description: string;
    }>
  ) =>
    request<Transaction>(`/api/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  duplicateTransaction: (id: string) =>
    request<Transaction>(`/api/transactions/${id}/duplicate`, { method: "POST" }),
  deleteTransaction: (id: string) =>
    request<void>(`/api/transactions/${id}`, { method: "DELETE" }),
  suggestCategory: (description: string, type: TxType) =>
    request<{ category_id: string | null; category_name: string | null; confidence: number }>(
      "/api/transactions/suggest-category",
      {
        method: "POST",
        body: JSON.stringify({ description, type }),
      }
    ),

  // Budgets
  listBudgets: (month?: string) =>
    request<BudgetUtilization[]>(`/api/budgets${month ? `?month=${month}` : ""}`),
  createBudget: (payload: {
    category_id: string;
    name: string;
    amount_limit: number;
    period: "weekly" | "monthly" | "yearly";
    start_date: string;
    end_date: string;
    alert_threshold?: number;
  }) =>
    request<BudgetUtilization>("/api/budgets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateBudget: (
    id: string,
    payload: Partial<{ name: string; amount_limit: number; alert_threshold: number }>
  ) =>
    request<BudgetUtilization>(`/api/budgets/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteBudget: (id: string) =>
    request<void>(`/api/budgets/${id}`, { method: "DELETE" }),

  // Reports
  getReportAnalytics: (params: { period?: string; start_date?: string; end_date?: string }) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    return request<ReportAnalyticsSummary>(`/api/reports/analytics?${sp.toString()}`);
  },
  listReports: () => request<ReportRecord[]>("/api/reports"),
  generatePdfReport: (payload: {
    title: string;
    report_type: "monthly" | "custom" | "annual";
    period_start: string;
    period_end: string;
  }) =>
    request<ReportRecord>("/api/reports/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // CSV Import
  previewCsv: (file: File, accountId?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (accountId) fd.append("account_id", accountId);
    return request<CSVImportPreviewResponse>("/api/import/csv/preview", {
      method: "POST",
      body: fd,
    });
  },
  commitCsv: (file: File, accountId: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("account_id", accountId);
    return request<{ imported_count: number; skipped_duplicates: number; errors: string[] }>(
      "/api/import/csv",
      { method: "POST", body: fd }
    );
  },
};
