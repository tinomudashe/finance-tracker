import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { DonutChart, LineChart, resolveBlueBlackColor } from "../components/Charts";
import { Icon } from "../components/Icons";
import {
  CardDragHandle,
  ExpandableCardSheet,
  MotionTooltip,
  usePersistedCardOrder,
} from "../components/MotionPatterns";
import { PageHeroCard } from "../components/Wallpapers";
import type { Account, DashboardSummary, Preferences, RouteId, Transaction, User } from "../types";
import { LABELS, fmtDate, fmtMoney, toNum } from "../utils/format";

export function DashboardView({
  user,
  summary,
  accounts,
  allTransactions,
  wallpaperCss,
  go,
  openAddTx,
}: {
  user: User;
  summary: DashboardSummary;
  accounts: Account[];
  allTransactions: Transaction[];
  wallpaperCss?: string;
  go: (r: RouteId) => void;
  openAddTx: () => void;
}) {
  const [statModal, setStatModal] = useState<string | null>(null);
  const currency = user.preferences?.currency || "USD";
  const lang: Preferences["language"] = user.preferences?.language || "en";
  const t = LABELS[lang] || LABELS.en;
  const firstName = (user.full_name || user.email).split(" ")[0];

  const baseStats = useMemo(
    () => [
      {
        id: "networth",
        label: "Net Worth",
        val: fmtMoney(summary.net_worth, { cents: false, currency }),
        delta: `${summary.net_worth_delta_pct >= 0 ? "+" : ""}${summary.net_worth_delta_pct}% this month`,
        up: summary.net_worth_delta_pct >= 0,
        down: summary.net_worth_delta_pct < 0,
        icon: "wallet",
        variant: "stat__ic--blue",
        progress: undefined as number | undefined,
      },
      {
        id: "income",
        label: "Monthly Income",
        val: fmtMoney(summary.month_income, { cents: false, currency }),
        delta: `${summary.income_delta_pct >= 0 ? "+" : ""}${summary.income_delta_pct}% vs last month`,
        up: summary.income_delta_pct >= 0,
        down: summary.income_delta_pct < 0,
        icon: "trendUp",
        variant: "stat__ic--blue",
        progress: undefined as number | undefined,
      },
      {
        id: "expense",
        label: "Monthly Expenses",
        val: fmtMoney(summary.month_expense, { cents: false, currency }),
        delta: `${summary.expense_delta_pct >= 0 ? "+" : ""}${summary.expense_delta_pct}% vs last month`,
        up: summary.expense_delta_pct <= 0,
        down: summary.expense_delta_pct > 0,
        icon: "trendDown",
        variant: "stat__ic--black",
        progress: undefined as number | undefined,
      },
      {
        id: "savings",
        label: "Savings Rate",
        val: `${summary.savings_rate}%`,
        delta: undefined as string | undefined,
        up: true,
        down: false,
        icon: "percent",
        variant: "stat__ic",
        progress: summary.savings_rate,
      },
    ],
    [summary, currency]
  );

  const {
    orderedItems: stats,
    draggingId,
    setDraggingId,
    swapIds,
    shuffleOrder,
    resetOrder,
    hasCustomOrder,
  } = usePersistedCardOrder("ft_order_kpis", baseStats);

  const selectedStat = stats.find((s) => s.id === statModal) || null;

  return (
    <div className="page">
      <PageHeroCard
        icon="dashboard"
        title={`${t.welcomeBack}, ${firstName}`}
        subtitle={summary.reference_month}
        wallpaperCss={wallpaperCss}
        rightSlot={
          <div style={{ display: "flex", gap: 6 }}>
            <MotionTooltip content="Shuffle KPI card order">
              <button type="button" className="btn btn--ghost btn--sm" onClick={shuffleOrder}>
                <Icon name="shuffle" /> Shuffle
              </button>
            </MotionTooltip>
            {hasCustomOrder && (
              <button type="button" className="btn btn--subtle btn--sm" onClick={resetOrder}>
                Reset
              </button>
            )}
          </div>
        }
      >
        <button className="btn btn--primary" onClick={openAddTx}>
          <Icon name="plus" /> {t.addTransaction}
        </button>
      </PageHeroCard>

      <div className="stat-grid">
        {stats.map((s) => {
          const cardLayoutId = `appstore-kpi-${s.id}`;
          return (
            <motion.div
              key={s.id}
              layout
              layoutId={cardLayoutId}
              transition={{ type: "spring", stiffness: 410, damping: 33 }}
              className={"stat" + (draggingId === s.id ? " mp-card-dragging" : "")}
              onClick={() => setStatModal(s.id)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingId && draggingId !== s.id) {
                  swapIds(draggingId, s.id);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingId(null);
              }}
            >
              <div className="stat__top">
                <motion.span layoutId={`${cardLayoutId}-title`} className="stat__label">
                  {s.label}
                </motion.span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span className={`stat__ic ${s.variant}`}>
                    <Icon name={s.icon} />
                  </span>
                  <CardDragHandle
                    id={s.id}
                    onStartDrag={setDraggingId}
                    onEndDrag={() => setDraggingId(null)}
                  />
                </span>
              </div>
              <motion.div layoutId={`${cardLayoutId}-val`} className="stat__val num">
                {s.val}
              </motion.div>
              {s.delta && (
                <div className={"stat__delta " + (s.down ? "down" : "up")}>
                  <Icon name={s.up ? "trendUp" : "trendDown"} />
                  {s.delta}
                </div>
              )}
              {s.progress != null && (
                <div className="bar" style={{ marginTop: 12 }}>
                  <motion.i
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, s.progress)}%` }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    style={{ background: "var(--blue-600)" }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, marginTop: 18 }}>
        <div className="card card--pad">
          <div className="card-head">
            <div>
              <div className="card-title">Income vs Expenses</div>
              <div className="card-sub">Last 6 months</div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600 }}>
                <span style={{ width: 18, height: 3, borderRadius: 2, background: "var(--chart-inc)" }} />
                Income
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600 }}>
                <span style={{ width: 18, height: 3, borderRadius: 2, background: "var(--chart-exp)" }} />
                Expenses
              </span>
            </div>
          </div>
          <LineChart data={summary.trend} height={210} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 6px" }}>
            {summary.trend.map((p, idx) => (
              <span key={idx} className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>
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
              {summary.breakdown.slice(0, 6).map((b, i) => (
                <div key={b.category_id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 4,
                      background: resolveBlueBlackColor(b.color, i),
                      flexShrink: 0,
                    }}
                  />
                  <span className="cell-muted" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.label}
                  </span>
                  <span className="num" style={{ fontWeight: 700 }}>
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
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{b.category_name}</span>
                    <span className="num muted" style={{ fontSize: 13 }}>
                      <b style={{ color: b.over_budget ? "var(--blue-600)" : "var(--ink)" }}>
                        {fmtMoney(b.amount_spent, { cents: false, currency })}
                      </b>{" "}
                      / {fmtMoney(b.amount_limit, { cents: false, currency })}
                    </span>
                  </div>
                  <div className="bar">
                    <i
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background: b.over_budget ? "var(--black-950)" : "var(--blue-600)",
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
                    <span className={"bare-icon " + (pos ? "bare-icon--blue" : "")}>
                      <Icon name={pos ? "trendUp" : "trendDown"} />
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
                  <span className={(pos ? "amt-pos" : "amt-neg") + " num"}>
                    {fmtMoney(tx.signed_amount, { sign: true, currency })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ExpandableCardSheet
        open={Boolean(selectedStat)}
        cardLayoutId={selectedStat ? `appstore-kpi-${selectedStat.id}` : "appstore-kpi-none"}
        subtitle={summary.reference_month}
        title={
          selectedStat?.id === "networth"
            ? "Net worth breakdown"
            : selectedStat?.label || ""
        }
        headlineValue={selectedStat?.val}
        onClose={() => setStatModal(null)}
      >
        {selectedStat && (
          <StatSheetBody
            id={selectedStat.id}
            summary={summary}
            accounts={accounts}
            transactions={allTransactions}
            currency={currency}
          />
        )}
      </ExpandableCardSheet>
    </div>
  );
}

function StatSheetBody({
  id,
  summary,
  accounts,
  transactions,
  currency,
}: {
  id: string;
  summary: DashboardSummary;
  accounts: Account[];
  transactions: Transaction[];
  currency: string;
}) {
  if (id === "networth") {
    return (
      <>
        <div className="grid2" style={{ marginBottom: 18 }}>
          <div className="callout-tile callout-tile--blue">
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Total Net Worth
            </div>
            <div className="num" style={{ fontSize: 27, fontWeight: 700, marginTop: 4 }}>
              {fmtMoney(summary.net_worth, { currency })}
            </div>
          </div>
          <div className="callout-tile callout-tile--black">
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Monthly Change
            </div>
            <div className="num" style={{ fontSize: 27, fontWeight: 700, marginTop: 4 }}>
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
              padding: "12px 16px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div className="muted" style={{ fontSize: 12, textTransform: "capitalize" }}>
                {a.account_type}
              </div>
            </div>
            <span className="num" style={{ fontWeight: 700, fontSize: 16 }}>
              {fmtMoney(a.current_balance, { currency })}
            </span>
          </div>
        ))}
      </>
    );
  }

  if (id === "savings") {
    const saved = toNum(summary.month_income) - toNum(summary.month_expense);
    return (
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <div className="muted" style={{ fontSize: 14 }}>
          Net monthly savings: <b className="num" style={{ color: "var(--ink)" }}>{fmtMoney(saved, { currency })}</b>
        </div>
      </div>
    );
  }

  const list =
    id === "income"
      ? transactions.filter((t) => t.type === "credit")
      : transactions.filter((t) => t.type === "debit");

  return (
    <div style={{ maxHeight: 340, overflowY: "auto" }}>
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
  );
}
