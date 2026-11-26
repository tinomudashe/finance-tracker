import { useState } from "react";
import { motion } from "motion/react";
import { api } from "../api/client";
import { BaseDatePicker, BaseInput, BaseSelect, CurrencyInput } from "../components/BaseControls";
import { Icon } from "../components/Icons";
import {
  CardDragHandle,
  ExpandableCardSheet,
  MorphEditButton,
  MotionTooltip,
  usePersistedCardOrder,
} from "../components/MotionPatterns";
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
  const [detailId, setDetailId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const {
    orderedItems,
    draggingId,
    setDraggingId,
    swapIds,
    shuffleOrder,
    resetOrder,
    hasCustomOrder,
  } = usePersistedCardOrder("ft_order_budgets", budgets);

  const totalLimit = budgets.reduce((s, b) => s + toNum(b.amount_limit), 0);
  const totalSpent = budgets.reduce((s, b) => s + toNum(b.amount_spent), 0);
  const pct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const detail = orderedItems.find((b) => b.id === detailId) || null;

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
        rightSlot={
          <div style={{ display: "flex", gap: 6 }}>
            <MotionTooltip content="Shuffle budget cards">
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
        <button className="btn btn--primary" onClick={() => setCreating(true)}>
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
          <motion.i
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, pct)}%` }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: pct > 100 ? "var(--black-950)" : "var(--blue-600)",
            }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 18 }}>
        {orderedItems.map((b) => {
          const p = Math.round(toNum(b.pct_used));
          const rem = toNum(b.remaining_balance);
          const cardLayoutId = `appstore-budget-${b.id}`;
          return (
            <motion.div
              key={b.id}
              layout
              layoutId={cardLayoutId}
              transition={{ type: "spring", stiffness: 410, damping: 33 }}
              className={"card card--pad" + (draggingId === b.id ? " mp-card-dragging" : "")}
              style={{ cursor: "pointer" }}
              onClick={() => setDetailId(b.id)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingId && draggingId !== b.id) swapIds(draggingId, b.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingId(null);
              }}
            >
              <div className="between">
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span className={"bare-icon " + (b.over_budget ? "bare-icon--blue" : "")}>
                    <Icon name={b.over_budget ? "alert" : "budgets"} />
                  </span>
                  <div>
                    <motion.div
                      layoutId={`${cardLayoutId}-title`}
                      className="cell-strong"
                      style={{ fontSize: 15 }}
                    >
                      {b.category_name}
                    </motion.div>
                    <div className="muted num" style={{ fontSize: 12 }}>
                      {b.start_date} → {b.end_date}
                    </div>
                  </div>
                </div>
                <span className="row-act" onClick={(e) => e.stopPropagation()}>
                  <MorphEditButton
                    morphId={`budget-${b.id}`}
                    title={`Edit ${b.category_name} Budget`}
                    tooltip="Edit budget"
                  >
                    {(close) => (
                      <BudgetEditorBody
                        initial={b}
                        categories={categories.filter((c) => c.type === "expense")}
                        currency={currency}
                        onCancel={close}
                        onSaved={(msg) => {
                          close();
                          onChanged(msg);
                        }}
                      />
                    )}
                  </MorphEditButton>

                  <MotionTooltip content="Delete budget">
                    <button
                      type="button"
                      className="mini-btn danger"
                      onClick={() => handleDelete(b)}
                      aria-label="Delete budget"
                    >
                      <Icon name="trash" />
                    </button>
                  </MotionTooltip>

                  <CardDragHandle
                    id={b.id}
                    onStartDrag={setDraggingId}
                    onEndDrag={() => setDraggingId(null)}
                  />
                </span>
              </div>

              <div className="between" style={{ marginTop: 16, marginBottom: 8 }}>
                <motion.span
                  layoutId={`${cardLayoutId}-val`}
                  className="num"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: b.over_budget ? "var(--ink)" : "var(--ink-2)",
                  }}
                >
                  {p}%
                </motion.span>
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
            </motion.div>
          );
        })}
      </div>

      <ExpandableCardSheet
        open={Boolean(detail)}
        cardLayoutId={detail ? `appstore-budget-${detail.id}` : "appstore-budget-none"}
        subtitle={detail ? `${detail.start_date} → ${detail.end_date}` : undefined}
        title={detail ? `${detail.category_name} budget` : ""}
        headlineValue={detail ? `${Math.round(toNum(detail.pct_used))}% used` : undefined}
        onClose={() => setDetailId(null)}
      >
        {detail && (
          <>
            <div className="between" style={{ marginBottom: 12 }}>
              <span className="num" style={{ fontWeight: 700, fontSize: 15 }}>
                {fmtMoney(detail.amount_spent, { currency })} spent of{" "}
                {fmtMoney(detail.amount_limit, { currency })}
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
          </>
        )}
      </ExpandableCardSheet>

      {creating && (
        <Modal title="Create Budget" onClose={() => setCreating(false)}>
          <div style={{ margin: "-24px" }}>
            <BudgetEditorBody
              initial={null}
              categories={categories.filter((c) => c.type === "expense")}
              currency={currency}
              onCancel={() => setCreating(false)}
              onSaved={(msg) => {
                setCreating(false);
                onChanged(msg);
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function BudgetEditorBody({
  initial,
  categories,
  currency,
  onCancel,
  onSaved,
}: {
  initial: BudgetUtilization | null;
  categories: Category[];
  currency: string;
  onCancel: () => void;
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
    <>
      <div className="mp-morph-panel__body">
        {err && <div className="error-banner">{err}</div>}
        {!initial && (
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Expense Category</label>
            <BaseSelect
              value={catId}
              onValueChange={setCatId}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
        )}
        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Monthly limit</label>
            <CurrencyInput value={limit} onValueChange={setLimit} currency={currency} />
          </div>
          <div className="field">
            <label>Alert threshold</label>
            <BaseInput
              className="num"
              value={threshold}
              endAdornment={
                <span className="num" style={{ fontWeight: 700 }}>
                  %
                </span>
              }
              onChange={(e) => setThreshold(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
        </div>
        {!initial && (
          <div className="grid2">
            <div className="field">
              <label>Start date</label>
              <BaseDatePicker value={start} onChange={setStart} ariaLabel="Start date" />
            </div>
            <div className="field">
              <label>End date</label>
              <BaseDatePicker value={end} onChange={setEnd} ariaLabel="End date" />
            </div>
          </div>
        )}
      </div>
      <div className="mp-morph-panel__foot">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" onClick={save}>
          <Icon name="check" /> Save
        </button>
      </div>
    </>
  );
}
