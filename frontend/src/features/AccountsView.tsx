import { useState } from "react";
import { api } from "../api/client";
import { Icon } from "../components/Icons";
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
  const [detail, setDetail] = useState<Account | null>(null);
  const [editing, setEditing] = useState<Account | "new" | null>(null);

  const total = accounts.reduce((s, a) => s + toNum(a.current_balance), 0);
  const cardBg = wallpaperCss || PEXELS_WALLPAPERS[0].cssImage;

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
      >
        <button className="btn btn--primary" onClick={() => setEditing("new")}>
          <Icon name="plus" /> Add Account
        </button>
      </PageHeroCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 18 }}>
        {accounts.map((a) => {
          const neg = toNum(a.current_balance) < 0;
          return (
            <div
              className="card card--pad"
              key={a.id}
              style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}
              onClick={() => setDetail(a)}
            >
              <div className="acct-wallpaper" style={{ backgroundImage: cardBg }}>
                <span
                  className={"badge " + (neg ? "badge--black" : "badge--blue")}
                  style={{ textTransform: "capitalize" }}
                >
                  <Icon name={KIND_ICON[a.account_type] || "wallet"} /> {a.account_type}
                </span>
                <span className="row-act" onClick={(e) => e.stopPropagation()}>
                  <button className="mini-btn" title="Edit" onClick={() => setEditing(a)}>
                    <Icon name="edit" />
                  </button>
                  <button className="mini-btn danger" title="Delete" onClick={() => handleDelete(a)}>
                    <Icon name="trash" />
                  </button>
                </span>
              </div>

              <div className="between">
                <div className="cell-strong" style={{ fontSize: 16 }}>
                  {a.name}
                </div>
                <span className="muted num" style={{ fontSize: 12, fontWeight: 700 }}>
                  {a.currency}
                </span>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Balance
                </div>
                <div className="num" style={{ fontSize: 29, fontWeight: 700, color: "var(--ink)" }}>
                  {fmtMoney(a.current_balance, { currency })}
                </div>
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
            </div>
          );
        })}
      </div>

      {detail && (
        <AccountDetailModal
          account={detail}
          transactions={transactions.filter((t) => t.account_id === detail.id)}
          currency={currency}
          onClose={() => setDetail(null)}
        />
      )}

      {editing && (
        <AccountFormModal
          initial={editing === "new" ? null : editing}
          defaultCurrency={currency}
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

function AccountDetailModal({
  account,
  transactions,
  currency,
  onClose,
}: {
  account: Account;
  transactions: Transaction[];
  currency: string;
  onClose: () => void;
}) {
  return (
    <Modal title={account.name} onClose={onClose} width={560}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div className="muted" style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Current balance
        </div>
        <div className="num" style={{ fontSize: 36, fontWeight: 700, color: "var(--ink)" }}>
          {fmtMoney(account.current_balance, { currency })}
        </div>
      </div>
      <div className="grid2" style={{ marginBottom: 16 }}>
        <div className="callout-tile callout-tile--blue">
          <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Money in
          </div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
            {fmtMoney(account.money_in, { cents: false, currency })}
          </div>
        </div>
        <div className="callout-tile callout-tile--black">
          <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Money out
          </div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
            {fmtMoney(account.money_out, { cents: false, currency })}
          </div>
        </div>
      </div>
      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {transactions.map((t) => (
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
    </Modal>
  );
}

function AccountFormModal({
  initial,
  defaultCurrency,
  onClose,
  onSaved,
}: {
  initial: Account | null;
  defaultCurrency: string;
  onClose: () => void;
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
    <Modal
      title={initial ? "Edit Account" : "Add Account"}
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
      <div className="field" style={{ marginBottom: 14 }}>
        <label>Account name</label>
        <input
          className="input"
          placeholder="Everyday Checking"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="field">
          <label>Account type</label>
          <select
            className="select"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AccountType)}
          >
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="investment">Investment</option>
            <option value="credit">Credit</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div className="field">
          <label>Currency</label>
          <select className="select" value={cur} onChange={(e) => setCur(e.target.value)}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Opening balance</label>
        <input
          className="input num"
          value={opening}
          onChange={(e) => setOpening(e.target.value.replace(/[^0-9.-]/g, ""))}
        />
      </div>
    </Modal>
  );
}
