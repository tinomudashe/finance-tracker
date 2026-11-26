import { useState } from "react";
import { motion } from "motion/react";
import { api } from "../api/client";
import { BaseInput, BaseSelect, CurrencyInput } from "../components/BaseControls";
import { Icon } from "../components/Icons";
import {
  CardDragHandle,
  ExpandableCardSheet,
  MorphEditButton,
  MotionTooltip,
  usePersistedCardOrder,
} from "../components/MotionPatterns";
import { Modal } from "../components/Shell";
import { PageHeroCard, PEXELS_WALLPAPERS } from "../components/Wallpapers";
import type { Account, AccountType, Transaction } from "../types";
import { fmtDate, fmtMoney, toNum } from "../utils/format";

const KIND_ICON: Record<AccountType, string> = {
  checking: "building",
  savings: "piggy",
  investment: "trendUp",
  credit: "card",
  cash: "cash",
};

export function AccountsView({
  accounts,
  transactions,
  currency,
  wallpaperCss,
  onChanged,
  onError,
}: {
  accounts: Account[];
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
  } = usePersistedCardOrder("ft_order_accounts", accounts);

  const total = accounts.reduce((s, a) => s + toNum(a.current_balance), 0);
  const cardBg = wallpaperCss || PEXELS_WALLPAPERS[0].cssImage;
  const detail = orderedItems.find((a) => a.id === detailId) || null;

  const handleDelete = async (a: Account) => {
    try {
      await api.deleteAccount(a.id);
      onChanged("Account deleted");
    } catch (ex) {
      onError(ex instanceof Error ? ex.message : "Cannot delete account");
    }
  };

  return (
    <div className="page">
      <PageHeroCard
        icon="accounts"
        title="Accounts"
        subtitle={
          <>
            {accounts.length} accounts · total balance{" "}
            <b className="num" style={{ color: "var(--ink)" }}>
              {fmtMoney(total, { cents: false, currency })}
            </b>
          </>
        }
        wallpaperCss={wallpaperCss}
        rightSlot={
          <div style={{ display: "flex", gap: 6 }}>
            <MotionTooltip content="Shuffle account cards">
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
          <Icon name="plus" /> Add Account
        </button>
      </PageHeroCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 18 }}>
        {orderedItems.map((a) => {
          const neg = toNum(a.current_balance) < 0;
          const cardLayoutId = `appstore-acct-${a.id}`;
          return (
            <motion.div
              key={a.id}
              layout
              layoutId={cardLayoutId}
              transition={{ type: "spring", stiffness: 410, damping: 33 }}
              className={"card card--pad" + (draggingId === a.id ? " mp-card-dragging" : "")}
              style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}
              onClick={() => setDetailId(a.id)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingId && draggingId !== a.id) swapIds(draggingId, a.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingId(null);
              }}
            >
              <div className="acct-wallpaper" style={{ backgroundImage: cardBg }}>
                <span
                  className={"badge " + (neg ? "badge--black" : "badge--blue")}
                  style={{ textTransform: "capitalize" }}
                >
                  <Icon name={KIND_ICON[a.account_type] || "wallet"} /> {a.account_type}
                </span>
                <span className="row-act" onClick={(e) => e.stopPropagation()}>
                  <MorphEditButton
                    morphId={`acct-${a.id}`}
                    title="Edit Account"
                    tooltip="Edit account"
                  >
                    {(close) => (
                      <AccountEditorBody
                        initial={a}
                        defaultCurrency={currency}
                        onCancel={close}
                        onSaved={(msg) => {
                          close();
                          onChanged(msg);
                        }}
                      />
                    )}
                  </MorphEditButton>

                  <MotionTooltip content="Delete account">
                    <button
                      type="button"
                      className="mini-btn danger"
                      onClick={() => handleDelete(a)}
                      aria-label="Delete account"
                    >
                      <Icon name="trash" />
                    </button>
                  </MotionTooltip>

                  <CardDragHandle
                    id={a.id}
                    onStartDrag={setDraggingId}
                    onEndDrag={() => setDraggingId(null)}
                  />
                </span>
              </div>

              <div className="between">
                <motion.div
                  layoutId={`${cardLayoutId}-title`}
                  className="cell-strong"
                  style={{ fontSize: 16 }}
                >
                  {a.name}
                </motion.div>
                <span className="muted num" style={{ fontSize: 12, fontWeight: 700 }}>
                  {a.currency}
                </span>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Balance
                </div>
                <motion.div
                  layoutId={`${cardLayoutId}-val`}
                  className="num"
                  style={{ fontSize: 29, fontWeight: 700, color: "var(--ink)" }}
                >
                  {fmtMoney(a.current_balance, { currency })}
                </motion.div>
              </div>

              <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <div
                  className="muted"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Recent activity
                </div>
                {a.recent_transactions.map((t) => (
                  <div key={t.id} className="between" style={{ padding: "4px 0", fontSize: 13 }}>
                    <span
                      className="cell-muted"
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 180,
                      }}
                    >
                      {t.description}
                    </span>
                    <span className={(toNum(t.signed_amount) >= 0 ? "amt-pos" : "amt-neg") + " num"}>
                      {fmtMoney(t.signed_amount, { sign: true, currency })}
                    </span>
                  </div>
                ))}
                {a.recent_transactions.length === 0 && (
                  <div className="muted" style={{ fontSize: 13 }}>
                    No recent activity
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <ExpandableCardSheet
        open={Boolean(detail)}
        cardLayoutId={detail ? `appstore-acct-${detail.id}` : "appstore-acct-none"}
        subtitle={detail ? `${detail.account_type.toUpperCase()} · ${detail.currency}` : undefined}
        title={detail?.name || ""}
        headlineValue={detail ? fmtMoney(detail.current_balance, { currency }) : undefined}
        onClose={() => setDetailId(null)}
      >
        {detail && (
          <>
            <div className="grid2" style={{ marginBottom: 16 }}>
              <div className="callout-tile callout-tile--blue">
                <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Money in
                </div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                  {fmtMoney(detail.money_in, { cents: false, currency })}
                </div>
              </div>
              <div className="callout-tile callout-tile--black">
                <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Money out
                </div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                  {fmtMoney(detail.money_out, { cents: false, currency })}
                </div>
              </div>
            </div>
            <div style={{ maxHeight: 250, overflowY: "auto" }}>
              {transactions
                .filter((t) => t.account_id === detail.id)
                .map((t) => (
                  <div
                    key={t.id}
                    className="between"
                    style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}
                  >
                    <div>
                      <div className="cell-strong" style={{ fontSize: 13.5 }}>
                        {t.description}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {fmtDate(t.transaction_date)} · {t.category_name}
                      </div>
                    </div>
                    <span className={(toNum(t.signed_amount) >= 0 ? "amt-pos" : "amt-neg") + " num"}>
                      {fmtMoney(t.signed_amount, { sign: true, currency })}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}
      </ExpandableCardSheet>

      {creating && (
        <Modal title="Add Account" onClose={() => setCreating(false)}>
          <div style={{ margin: "-24px" }}>
            <AccountEditorBody
              initial={null}
              defaultCurrency={currency}
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

function AccountEditorBody({
  initial,
  defaultCurrency,
  onCancel,
  onSaved,
}: {
  initial: Account | null;
  defaultCurrency: string;
  onCancel: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [accountType, setAccountType] = useState<AccountType>(initial?.account_type || "checking");
  const [cur, setCur] = useState(initial?.currency || defaultCurrency || "USD");
  const [opening, setOpening] = useState(initial ? String(toNum(initial.opening_balance)) : "0.00");
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setErr("Account name is required");
      return;
    }
    try {
      if (initial) {
        await api.updateAccount(initial.id, {
          name: name.trim(),
          account_type: accountType,
          currency: cur,
          opening_balance: parseFloat(opening) || 0,
        });
        onSaved("Account updated");
      } else {
        await api.createAccount({
          name: name.trim(),
          account_type: accountType,
          currency: cur,
          opening_balance: parseFloat(opening) || 0,
        });
        onSaved("Account created");
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to save account");
    }
  };

  return (
    <>
      <div className="mp-morph-panel__body">
        {err && <div className="error-banner">{err}</div>}
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Account name</label>
          <BaseInput
            placeholder="Everyday Checking"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Account type</label>
            <BaseSelect
              value={accountType}
              onValueChange={(v) => setAccountType(v as AccountType)}
              options={[
                { value: "checking", label: "Checking" },
                { value: "savings", label: "Savings" },
                { value: "investment", label: "Investment" },
                { value: "credit", label: "Credit" },
                { value: "cash", label: "Cash" },
              ]}
            />
          </div>
          <div className="field">
            <label>Currency</label>
            <BaseSelect
              value={cur}
              onValueChange={setCur}
              options={[
                { value: "USD", label: "USD — US Dollar" },
                { value: "EUR", label: "EUR — Euro" },
                { value: "GBP", label: "GBP — Pound" },
              ]}
            />
          </div>
        </div>
        <div className="field">
          <label>Opening balance</label>
          <CurrencyInput
            value={opening}
            onValueChange={setOpening}
            currency={cur}
            allowNegative
          />
        </div>
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
