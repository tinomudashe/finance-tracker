import { useState } from "react";
import { DonutChart, LineChart } from "../components/Charts";
import { Icon } from "../components/Icons";
import { Modal } from "../components/Shell";
import type { Account, DashboardSummary, Preferences, RouteId, Transaction, User } from "../types";
import { LABELS, fmtDate, fmtMoney, toNum } from "../utils/format";

export function DashboardView({
  user,
  summary,
  accounts,
  allTransactions,
  go,
  openAddTx,
}: {
  user: User;
  summary: DashboardSummary;
  accounts: Account[];
  allTransactions: Transaction[];
  go: (r: RouteId) => void;
  openAddTx: () => void;
}) {
  const [statModal, setStatModal] = useState<string | null>(null);
  const currency = user.preferences?.currency || "USD";
  const lang: Preferences["language"] = user.preferences?.language || "en";
  const t = LABELS[lang] || LABELS.en;
  const firstName = (user.full_name || user.email).split(" ")[0];

  const stats = [
    {
      id: "networth",
      label: "Net Worth",
      val: fmtMoney(summary.net_worth, { cents: false, currency }),
      delta: `${summary.net_worth_delta_pct >= 0 ? "+" : ""}${summary.net_worth_delta_pct}% this month`,
      up: summary.net_worth_delta_pct >= 0,
      icon: "wallet",
      tone: "var(--blue)",
      soft: "var(--blue-soft)",
    },
    {
      id: "income",
      label: "Monthly Income",
      val: fmtMoney(summary.month_income, { cents: false, currency }),
      delta: `${summary.income_delta_pct >= 0 ? "+" : ""}${summary.income_delta_pct}% vs last month`,
      up: summary.income_delta_pct >= 0,
      icon: "trendUp",
      tone: "var(--pos)",
      soft: "var(--pos-soft)",
    },
    {
      id: "expense",
      label: "Monthly Expenses",
      val: fmtMoney(summary.month_expense, { cents: false, currency }),
      delta: `${summary.expense_delta_pct >= 0 ? "+" : ""}${summary.expense_delta_pct}% vs last month`,
      up: summary.expense_delta_pct <= 0,
      down: summary.expense_delta_pct > 0,
      icon: "trendDown",
      tone: "var(--neg)",
      soft: "var(--neg-soft)",
    },
    {
      id: "savings",
      label: "Savings Rate",
      val: `${summary.savings_rate}%`,
      icon: "percent",
      tone: "var(--blue)",
      soft: "var(--blue-soft)",
      progress: summary.savings_rate,
    },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__left">
          <span className="sf-head-icon">
            <Icon name="dashboard" />
          </span>
          <div>
            <div className="page-head__eyebrow">Home</div>
            <h1>
              {t.welcomeBack}, {firstName}
            </h1>
            <div className="sub">{summary.reference_month}</div>
          </div>
        </div>
        <button className="btn btn--primary" onClick={openAddTx}>
          <Icon name="plus" /> {t.addTransaction}
        </button>
      </div>

      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat" key={s.id} onClick={() => setStatModal(s.id)}>
            <div className="stat__top">
              <span className="stat__label">{s.label}</span>
              <span className="stat__ic" style={{ background: s.soft, color: s.tone }}>
                <Icon name={s.icon} />
              </span>
            </div>
            <div className="stat__val num">{s.val}</div>
            {s.delta && (
              <div className={"stat__delta " + (s.down ? "down" : "up")}>
                <Icon name={s.up ? "trendUp" : "trendDown"} />
                {s.delta}
              </div>
            )}
            {s.progress != null && (
              <div className="bar" style={{ marginTop: 12 }}>
                <i style={{ width: `${Math.min(100, s.progress)}%`, background: "var(--blue)" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, marginTop: 18 }}>
        <div className="card card--pad">
          <div className="card-head">
            <div>
              <div className="card-title">Income vs Expenses</div>
              <div className="card-sub">Last 6 months</div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5 }}>
                <span style={{ width: 18, height: 3, borderRadius: 2, background: "var(--pos)" }} />
                Income
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5 }}>
                <span style={{ width: 18, height: 3, borderRadius: 2, background: "var(--neg)" }} />
                Expenses
              </span>
            </div>
          </div>
          <LineChart data={summary.trend} height={210} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 6px" }}>
            {summary.trend.map((p, idx) => (
              <span key={idx} className="muted" style={{ fontSize: 11.5 }}>
                {p.month}
              </span>
            ))}
          </div>
        </div>

        <div className="card card--pad">
          <div className="card-head">
            <div>
              <div className="card-title">Expense Breakdown</div>
              <div className="card-sub">{summary.reference_month}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <DonutChart data={summary.breakdown} size={188} thickness={24} currency={currency} />
            <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
              {summary.breakdown.slice(0, 6).map((b) => (
                <div key={b.category_id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color, flexShrink: 0 }} />
                  <span className="cell-muted" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.label}
                  </span>
                  <span className="num" style={{ fontWeight: 600 }}>
                    {fmtMoney(b.value, { cents: false, currency })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 18, marginTop: 18 }}>
        <div className="card card--pad">
          <div className="card-head">
            <div className="card-title">Budget overview</div>
            <button className="btn btn--subtle btn--sm" onClick={() => go("budgets")}>
              View all
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {summary.budgets.slice(0, 5).map((b) => {
              const pct = Math.round(toNum(b.pct_used));
              return (
                <div key={b.id}>
                  <div className="between" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{b.category_name}</span>
                    <span className="num muted" style={{ fontSize: 12.5 }}>
                      <b style={{ color: b.over_budget ? "var(--neg)" : "var(--ink)" }}>
                        {fmtMoney(b.amount_spent, { cents: false, currency })}
                      </b>{" "}
                      / {fmtMoney(b.amount_limit, { cents: false, currency })}
                    </span>
                  </div>
                  <div className="bar">
                    <i
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background: b.over_budget ? "var(--neg)" : b.category_color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {summary.budgets.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>
                No monthly budgets configured yet.
              </div>
            )}
          </div>
        </div>

        <div className="card card--pad">
          <div className="card-head">
            <div className="card-title">Recent transactions</div>
            <button className="btn btn--subtle btn--sm" onClick={() => go("transactions")}>
              View all
            </button>
          </div>
          <div>
            {summary.recent_transactions.map((tx) => {
              const pos = toNum(tx.signed_amount) >= 0;
              return (
                <div
                  key={tx.id}
                  className="between"
                  style={{ padding: "11px 0", borderBottom: "1px solid var(--line)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span
                      className="stat__ic"
                      style={{ width: 34, height: 34, background: "var(--surface-3)", color: tx.category_color }}
                    >
                      <Icon name={pos ? "trendUp" : "trendDown"} style={{ width: 16, height: 16 }} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="cell-strong"
                        style={{
                          fontSize: 13.5,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 250,
                        }}
                      >
                        {tx.description}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {tx.category_name} · {tx.account_name}
                      </div>
                    </div>
                  </div>
                  <span className={(pos ? "amt-pos" : "amt-neg") + " num"} style={{ fontSize: 14 }}>
                    {fmtMoney(tx.signed_amount, { sign: true, currency })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {statModal && (
        <StatDetailModal
          id={statModal}
          summary={summary}
          accounts={accounts}
          transactions={allTransactions}
          currency={currency}
          onClose={() => setStatModal(null)}
        />
      )}
    </div>
  );
}

function StatDetailModal({
  id,
  summary,
  accounts,
  transactions,
  currency,
  onClose,
}: {
  id: string;
  summary: DashboardSummary;
  accounts: Account[];
  transactions: Transaction[];
  currency: string;
  onClose: () => void;
}) {
  if (id === "networth") {
    return (
      <Modal title="Net worth breakdown" onClose={onClose} width={580}>
        <div className="grid2" style={{ marginBottom: 18 }}>
          <div style={{ background: "var(--blue-soft)", padding: 16, borderRadius: 4, textAlign: "center" }}>
            <div style={{ fontSize: 12.5, color: "var(--blue)", fontWeight: 600 }}>Total Net Worth</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: "var(--blue)" }}>
              {fmtMoney(summary.net_worth, { currency })}
            </div>
          </div>
          <div style={{ background: "var(--pos-soft)", padding: 16, borderRadius: 4, textAlign: "center" }}>
            <div style={{ fontSize: 12.5, color: "var(--pos)", fontWeight: 600 }}>Monthly Change</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: "var(--pos)" }}>
              {summary.net_worth_delta_pct >= 0 ? "+" : ""}
              {summary.net_worth_delta_pct}%
            </div>
          </div>
        </div>
        {accounts.map((a) => (
          <div
            key={a.id}
            className="between"
            style={{
              padding: "12px 14px",
              background: "var(--surface-2)",
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div className="muted" style={{ fontSize: 12, textTransform: "capitalize" }}>
                {a.account_type}
              </div>
            </div>
            <span
              className="num"
              style={{
                fontWeight: 600,
                color: toNum(a.current_balance) < 0 ? "var(--neg)" : "var(--ink)",
              }}
            >
              {fmtMoney(a.current_balance, { currency })}
            </span>
          </div>
        ))}
      </Modal>
    );
  }

  if (id === "savings") {
    const saved = toNum(summary.month_income) - toNum(summary.month_expense);
    return (
      <Modal title="Savings rate" onClose={onClose} width={500}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div className="num" style={{ fontSize: 44, fontWeight: 700, color: "var(--blue)" }}>
            {summary.savings_rate}%
          </div>
          <div className="muted">of monthly income saved ({fmtMoney(saved, { currency })})</div>
        </div>
      </Modal>
    );
  }

  const list =
    id === "income"
      ? transactions.filter((t) => t.type === "credit")
      : transactions.filter((t) => t.type === "debit");

  return (
    <Modal title={id === "income" ? "Income transactions" : "Expense transactions"} onClose={onClose}>
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {list.slice(0, 25).map((tx) => (
          <div
            key={tx.id}
            className="between"
            style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}
          >
            <div>
              <div className="cell-strong">{tx.description}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {fmtDate(tx.transaction_date)} · {tx.category_name}
              </div>
            </div>
            <span className={(toNum(tx.signed_amount) >= 0 ? "amt-pos" : "amt-neg") + " num"}>
              {fmtMoney(tx.signed_amount, { sign: true, currency })}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
