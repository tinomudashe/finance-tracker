import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BarChart, DonutChart, LineChart } from "../components/Charts";
import { AuthView } from "../features/AuthView";
import { DashboardView } from "../features/DashboardView";
import { fmtK, fmtMoney, LABELS, userInitials } from "../utils/format";

describe("FinanceTrace formatting & i18n utilities", () => {
  it("formats positive and negative amounts across USD, EUR, and GBP", () => {
    expect(fmtMoney(4820.55, { currency: "USD" })).toBe("$4,820.55");
    expect(fmtMoney(-1165.4, { sign: true, currency: "EUR" })).toBe("−€1,165.40");
    expect(fmtMoney(26400, { cents: false, currency: "GBP" })).toBe("£26,400");
    expect(fmtK(7500, "USD")).toBe("$7.5k");
    expect(userInitials("Daniel Brooks", "d@example.com")).toBe("DB");
    expect(LABELS.pl.transactions).toBe("Transakcje");
  });
});

describe("AuthView & DashboardView components", () => {
  it("toggles between Sign In and Create Account modes", () => {
    render(<AuthView onAuth={vi.fn()} />);
    expect(screen.getByText("Explore Demo Workspace (Daniel Brooks)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
  });

  it("renders Dashboard KPI cards, SVG charts, and opens Net Worth breakdown modal", () => {
    const mockUser = {
      id: "u1",
      email: "daniel.brooks@gmail.com",
      username: "danielbrooks",
      full_name: "Daniel Brooks",
      is_active: true,
      preferences: { theme: "light" as const, language: "en" as const, currency: "USD" as const },
      created_at: "2026-05-01T00:00:00Z",
    };
    const mockSummary = {
      reference_month: "May 2026",
      net_worth: 49125.15,
      month_income: 7672.3,
      month_expense: 2971.71,
      savings_rate: 61,
      income_delta_pct: 11.4,
      expense_delta_pct: -5.2,
      net_worth_delta_pct: 5.2,
      trend: [
        { month: "Apr", income: 6890, expense: 3100 },
        { month: "May", income: 7672, expense: 2971 },
      ],
      breakdown: [
        { category_id: "c1", label: "Rent", value: 1450, pct: 48.8, color: "#032d60" },
        { category_id: "c2", label: "Dining", value: 388.45, pct: 13.1, color: "#0176d3" },
      ],
      budgets: [
        {
          id: "b1",
          user_id: "u1",
          category_id: "c2",
          category_name: "Dining",
          category_color: "#0176d3",
          name: "Dining Budget",
          amount_limit: 350,
          period: "monthly" as const,
          start_date: "2026-05-01",
          end_date: "2026-05-31",
          alert_threshold: 80,
          amount_spent: 388.45,
          remaining_balance: -38.45,
          pct_used: 110.99,
          alert_triggered: true,
          over_budget: true,
        },
      ],
      recent_transactions: [],
    };

    render(
      <DashboardView
        user={mockUser}
        summary={mockSummary}
        accounts={[
          {
            id: "a1",
            user_id: "u1",
            name: "Everyday Checking",
            account_type: "checking",
            currency: "USD",
            opening_balance: 2000,
            current_balance: 4820.55,
            money_in: 7530,
            money_out: -4709.45,
            is_active: true,
            recent_transactions: [],
          },
        ]}
        allTransactions={[]}
        go={vi.fn()}
        openAddTx={vi.fn()}
      />
    );

    expect(screen.getByText("Welcome back, Daniel")).toBeInTheDocument();
    expect(screen.getByText("61%")).toBeInTheDocument();

    // Click Net Worth KPI card to open breakdown modal
    fireEvent.click(screen.getByText("Net Worth"));
    expect(screen.getByText("Net worth breakdown")).toBeInTheDocument();
    expect(screen.getByText("Everyday Checking")).toBeInTheDocument();
  });

  it("renders standalone DonutChart, BarChart, and LineChart SVG primitives", () => {
    const { container } = render(
      <div>
        <DonutChart
          data={[{ category_id: "1", label: "Rent", value: 1450, pct: 100, color: "#032d60" }]}
        />
        <BarChart data={[{ month: "May", income: 7000, expense: 3500 }]} />
        <LineChart
          data={[
            { month: "Apr", income: 6500, expense: 3200 },
            { month: "May", income: 7000, expense: 3500 },
          ]}
        />
      </div>
    );
    expect(container.querySelectorAll("svg").length).toBe(2);
    expect(screen.getByText("May")).toBeInTheDocument();
  });
});
