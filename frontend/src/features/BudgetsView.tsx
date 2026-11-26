import { useState } from "react";
import { api } from "../api/client";
import { Icon } from "../components/Icons";
import { Modal } from "../components/Shell";
import { PageHeroCard } from "../components/Wallpapers";
import type { BudgetUtilization, Category, Transaction } from "../types";
import { fmtDate, fmtMoney, toNum } from "../utils/format";

export function BudgetsView({
  budgets,
  categories,
  transactions,
  currency,
  wallpaperCss,
  onChanged,
  onError,
}: {
  budgets: BudgetUtilization[];
  categories: Category[];
  transactions: Transaction[];
  currency: string;
  wallpaperCss?: string;
  onChanged: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [detail, setDetail] = useState<BudgetUtilization | null>(null);
  const [editing, setEditing] = useState<BudgetUtilization | "new" | null>(null);

  const totalLimit = budgets.reduce((s, b) => s + toNum(b.amount_limit), 0);
  const totalSpent = budgets.reduce((s, b) => s + toNum(b.amount_spent), 0);
  const pct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  const handleDelete = async (b: BudgetUtilization) => {
    try {
      await api.deleteBudget(b.id);
      onChanged("Budget deleted");
    } catch (ex) {
      onError(ex instanceof Error ? ex.message : "Failed to delete budget");
    }
  };

  return (
    <div className="page">
      <PageHeroCard
        icon="budgets"
        title="Budget"
        subtitle={`${fmtMoney(totalSpent, { cents: false, currency })} spent of ${fmtMoney(totalLimit, { cents: false, currency })} budgeted · ${pct}% used`}
        wallpaperCss={wallpaperCss}
      >
        <button className="btn btn--primary" onClick={() => setEditing("new")}>
          <Icon name="plus" /> Create Budget
        </button>
      </PageHeroCard>

      <div className="card card--pad" style={{ marginBottom: 18 }}>
        <div className="between" style={{ marginBottom: 12 }}>
          <div>
            <div className="card-title">Total monthly budget</div>
            <div className="card-sub">Aggregated via budget_utilization</div>
          </div>
          <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>
            <span style={{ color: pct > 100 ? "var(--blue-600)" : "var(--ink)" }}>
              {fmtMoney(totalSpent, { cents: false, currency })}
            </span>
            <span className="muted" style={{ fontSize: 16, fontWeight: 600 }}>
              {" "}
              / {fmtMoney(totalLimit, { cents: false, currency })}
            </span>
          </div>
        </div>
        <div className="bar" style={{ height: 10 }}>
          <i
            style={{
              width: `${Math.min(100, pct)}%`,
              background: pct > 100 ? "var(--black-950)" : "var(--blue-600)",
            }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 18 }}>
        {budgets.map((b) => {
          const p = Math.round(toNum(b.pct_used));
          const rem = toNum(b.remaining_balance);
          return (
            <div
              className="card card--pad"
              key={b.id}
              style={{
                cursor: "pointer",
                borderColor: b.over_budget ? "var(--blue-600)" : "var(--border)",
                borderWidth: b.over_budget ? 1.5 : 1,
              }}
              onClick={() => setDetail(b)}
            >
              <div className="between">
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span className={"bare-icon " + (b.over_budget ? "bare-icon--blue" : "")}>
                    <Icon name={b.over_budget ? "alert" : "budgets"} />
                  </span>
                  <div>
                    <div className="cell-strong" style={{ fontSize: 15 }}>
                      {b.category_name}
                    </div>
                    <div className="muted num" style={{ fontSize: 12 }}>
                      {b.start_date} → {b.end_date}
                    </div>
                  </div>
                </div>
                <span className="row-act" onClick={(e) => e.stopPropagation()}>
                  <button className="mini-btn" title="Edit" onClick={() => setEditing(b)}>
                    <Icon name="edit" />
                  </button>
                  <button className="mini-btn danger" title="Delete" onClick={() => handleDelete(b)}>
                    <Icon name="trash" />
                  </button>
                </span>
              </div>

              <div className="between" style={{ marginTop: 16, marginBottom: 8 }}>
                <span
                  className="num"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: b.over_budget ? "var(--ink)" : "var(--ink-2)",
                  }}
                >
                  {p}%
                </span>
                {b.over_budget && (
                  <span className="badge badge--black">
                    <Icon name="alert" /> Over budget
                  </span>
                )}
                {!b.over_budget && b.alert_triggered && (
                  <span className="badge badge--outline-blue">Nearing limit</span>
                )}
              </div>
              <div className="bar" style={{ height: 8 }}>
                <i
                  style={{
                    width: `${Math.min(100, p)}%`,
                    background: b.over_budget ? "var(--black-950)" : "var(--blue-600)",
                  }}
                />
              </div>

              <div className="between" style={{ marginTop: 14 }}>
                <div>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    Spent
                  </div>
                  <div className="num cell-strong" style={{ fontSize: 16 }}>
                    {fmtMoney(b.amount_spent, { currency })}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    Limit
                  </div>
                  <div className="num cell-strong" style={{ fontSize: 16 }}>
                    {fmtMoney(b.amount_limit, { currency })}
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid var(--line)",
                  fontSize: 13,
                }}
              >
                Remaining:{" "}
                <b className="num" style={{ color: rem < 0 ? "var(--ink)" : "var(--pos)" }}>
                  {fmtMoney(rem, { currency })}
                </b>
              </div>
            </div>
          );
        })}
      </div>

      {detail && (
        <Modal title={`${detail.category_name} budget`} onClose={() => setDetail(null)} width={540}>
          <div className="between" style={{ marginBottom: 10 }}>
            <span className="num" style={{ fontWeight: 700, fontSize: 15 }}>
              {Math.round(toNum(detail.pct_used))}% used
            </span>
            <span className="num muted">
              {fmtMoney(detail.remaining_balance, { currency })} remaining
            </span>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {transactions
              .filter((t) => t.category_id === detail.category_id && t.type === "debit")
              .map((t) => (
                <div
                  key={t.id}
                  className="between"
                  style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}
                >
                  <div>
                    <div className="cell-strong">{t.description}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {fmtDate(t.transaction_date)} · {t.account_name}
                    </div>
                  </div>
                  <span className="amt-neg num">
                    {fmtMoney(t.signed_amount, { sign: true, currency })}
                  </span>
                </div>
              ))}
          </div>
        </Modal>
      )}

      {editing && (
        <BudgetFormModal
          initial={editing === "new" ? null : editing}
          categories={categories.filter((c) => c.type === "expense")}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            onChanged(msg);
          }}
        />
      )}
    </div>
  );
}

function BudgetFormModal({
  initial,
  categories,
  onClose,
  onSaved,
}: {
  initial: BudgetUtilization | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [catId, setCatId] = useState(initial?.category_id || categories[0]?.id || "");
  const [limit, setLimit] = useState(initial ? String(toNum(initial.amount_limit)) : "400");
  const [start, setStart] = useState(initial?.start_date || "2026-05-01");
  const [end, setEnd] = useState(initial?.end_date || "2026-05-31");
  const [threshold, setThreshold] = useState(
    initial ? String(toNum(initial.alert_threshold)) : "80"
  );
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    const lim = parseFloat(limit);
    if (!lim || lim <= 0 || !catId) {
      setErr("Select a category and enter a positive budget limit.");
      return;
    }
    const catName = categories.find((c) => c.id === catId)?.name || "Category";
    try {
      if (initial) {
        await api.updateBudget(initial.id, {
          amount_limit: lim,
          alert_threshold: parseFloat(threshold) || 80,
        });
        onSaved("Budget updated");
      } else {
        await api.createBudget({
          category_id: catId,
          name: `${catName} Budget`,
          amount_limit: lim,
          period: "monthly",
          start_date: start,
          end_date: end,
          alert_threshold: parseFloat(threshold) || 80,
        });
        onSaved("Budget created");
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to save budget");
    }
  };

  return (
    <Modal
      title={initial ? "Edit Budget" : "Create Budget"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={save}>
            <Icon name="check" /> Save
          </button>
        </>
      }
    >
      {err && <div className="error-banner">{err}</div>}
      {!initial && (
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Expense Category</label>
          <select className="select" value={catId} onChange={(e) => setCatId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="field">
          <label>Monthly limit</label>
          <input
            className="input num"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </div>
        <div className="field">
          <label>Alert threshold (%)</label>
          <input
            className="input num"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </div>
      </div>
      {!initial && (
        <div className="grid2">
          <div className="field">
            <label>Start date</label>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label>End date</label>
            <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
  );
}
