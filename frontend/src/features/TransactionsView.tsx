import { useMemo, useState } from "react";
import { api } from "../api/client";
import { Icon } from "../components/Icons";
import { Badge, Drawer, Modal } from "../components/Shell";
import type {
  Account,
  Category,
  CSVImportPreviewResponse,
  Transaction,
  TxType,
} from "../types";
import { fmtDate, fmtMoney, toNum } from "../utils/format";

export function TransactionsView({
  transactions,
  accounts,
  categories,
  currency,
  externalSearch,
  onExternalSearchChange,
  onOpenAdd,
  onOpenEdit,
  onDuplicate,
  onDelete,
  onImported,
}: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  currency: string;
  externalSearch: string;
  onExternalSearchChange: (q: string) => void;
  onOpenAdd: () => void;
  onOpenEdit: (t: Transaction) => void;
  onDuplicate: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onImported: (msg: string) => void;
}) {
  const [type, setType] = useState("all");
  const [acct, setAcct] = useState("all");
  const [cat, setCat] = useState("all");
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [confirmDel, setConfirmDel] = useState<Transaction | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (externalSearch.trim()) {
          const q = externalSearch.toLowerCase();
          const hit =
            (t.description || "").toLowerCase().includes(q) ||
            t.category_name.toLowerCase().includes(q) ||
            t.account_name.toLowerCase().includes(q);
          if (!hit) return false;
        }
        if (type === "income" && t.type !== "credit") return false;
        if (type === "expense" && t.type !== "debit") return false;
        if (type === "transfer" && t.type !== "transfer") return false;
        if (acct !== "all" && t.account_id !== acct) return false;
        if (cat !== "all" && t.category_id !== cat) return false;
        return true;
      }),
    [transactions, externalSearch, type, acct, cat]
  );

  const totalIn = filtered
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + toNum(t.amount), 0);
  const totalOut = filtered
    .filter((t) => t.type !== "credit")
    .reduce((s, t) => s - toNum(t.amount), 0);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__left">
          <span className="sf-head-icon">
            <Icon name="transactions" />
          </span>
          <div>
            <div className="page-head__eyebrow">Ledger</div>
            <h1>Transactions</h1>
            <div className="sub">
              {filtered.length} of {transactions.length} transactions ·{" "}
              <span className="num" style={{ fontWeight: 700, color: "var(--pos)" }}>
                {fmtMoney(totalIn, { cents: false, currency })}
              </span>{" "}
              in,{" "}
              <span className="num" style={{ fontWeight: 700, color: "var(--ink)" }}>
                {fmtMoney(totalOut, { cents: false, currency })}
              </span>{" "}
              out
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn--ghost" onClick={() => setCsvOpen(true)}>
            <Icon name="upload" /> Import CSV
          </button>
          <button className="btn btn--primary" onClick={onOpenAdd}>
            <Icon name="plus" /> Add Transaction
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div className="search">
          <Icon name="search" />
          <input
            placeholder="Search description, category, or account…"
            value={externalSearch}
            onChange={(e) => onExternalSearchChange(e.target.value)}
          />
        </div>
        <select
          className="select"
          style={{ width: 155 }}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </select>
        <select
          className="select"
          style={{ width: 195 }}
          value={acct}
          onChange={(e) => setAcct(e.target.value)}
        >
          <option value="all">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          className="select"
          style={{ width: 185 }}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Category</th>
                <th>Description</th>
                <th className="right">Amount</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const pos = toNum(t.signed_amount) >= 0;
                return (
                  <tr key={t.id} onClick={() => setDetail(t)}>
                    <td className="cell-muted num" style={{ whiteSpace: "nowrap" }}>
                      {fmtDate(t.transaction_date)}
                    </td>
                    <td className="cell-muted">{t.account_name}</td>
                    <td>
                      <Badge label={t.category_name} color={t.category_color} />
                    </td>
                    <td className="cell-strong">{t.description}</td>
                    <td className={"right num " + (pos ? "amt-pos" : "amt-neg")}>
                      {fmtMoney(t.signed_amount, { sign: true, currency })}
                    </td>
                    <td className="right">
                      <span className="row-act" onClick={(e) => e.stopPropagation()}>
                        <button className="mini-btn" title="Edit" onClick={() => onOpenEdit(t)}>
                          <Icon name="edit" />
                        </button>
                        <button className="mini-btn" title="Duplicate" onClick={() => onDuplicate(t)}>
                          <Icon name="copy" />
                        </button>
                        <button
                          className="mini-btn danger"
                          title="Delete"
                          onClick={() => setConfirmDel(t)}
                        >
                          <Icon name="trash" />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 42, color: "var(--ink-3)" }}>
                    No transactions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <Drawer
          title="Transaction details"
          onClose={() => setDetail(null)}
          footer={
            <>
              <button
                className="btn btn--ghost"
                style={{ flex: 1 }}
                onClick={() => {
                  const target = detail;
                  setDetail(null);
                  onOpenEdit(target);
                }}
              >
                <Icon name="edit" /> Edit
              </button>
              <button
                className="btn btn--subtle"
                style={{ flex: 1 }}
                onClick={() => {
                  const target = detail;
                  setDetail(null);
                  onDuplicate(target);
                }}
              >
                <Icon name="copy" /> Duplicate
              </button>
              <button
                className="btn btn--danger"
                onClick={() => {
                  const target = detail;
                  setDetail(null);
                  setConfirmDel(target);
                }}
              >
                <Icon name="trash" />
              </button>
            </>
          }
        >
          <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
            <span
              className={"badge " + (toNum(detail.signed_amount) >= 0 ? "badge--blue" : "badge--black")}
              style={{ marginBottom: 12 }}
            >
              {detail.type === "credit" ? "Income" : detail.type === "transfer" ? "Transfer" : "Expense"}
            </span>
            <div
              className="num"
              style={{
                fontSize: 38,
                fontWeight: 700,
                color: toNum(detail.signed_amount) >= 0 ? "var(--pos)" : "var(--ink)",
              }}
            >
              {fmtMoney(detail.signed_amount, { sign: true, currency })}
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--line)" }}>
            <div className="kv">
              <span className="k">Description</span>
              <span className="v">{detail.description}</span>
            </div>
            <div className="kv">
              <span className="k">Date</span>
              <span className="v num">{fmtDate(detail.transaction_date)}</span>
            </div>
            <div className="kv">
              <span className="k">Account</span>
              <span className="v">{detail.account_name}</span>
            </div>
            <div className="kv">
              <span className="k">Category</span>
              <span className="v">
                <Badge label={detail.category_name} color={detail.category_color} />
              </span>
            </div>
          </div>
        </Drawer>
      )}

      {confirmDel && (
        <Modal
          title="Delete transaction?"
          onClose={() => setConfirmDel(null)}
          width={440}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setConfirmDel(null)}>
                Cancel
              </button>
              <button
                className="btn btn--danger"
                onClick={() => {
                  const target = confirmDel;
                  setConfirmDel(null);
                  onDelete(target);
                }}
              >
                <Icon name="trash" /> Delete
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14.5, color: "var(--ink-2)" }}>
            You are about to delete <b>{confirmDel.description}</b> (
            {fmtMoney(confirmDel.signed_amount, { sign: true, currency })}). This action cannot be
            undone.
          </p>
        </Modal>
      )}

      {csvOpen && (
        <CSVImportModal
          accounts={accounts}
          currency={currency}
          onClose={() => setCsvOpen(false)}
          onDone={(msg) => {
            setCsvOpen(false);
            onImported(msg);
          }}
        />
      )}
    </div>
  );
}

export function TransactionFormModal({
  accounts,
  categories,
  initial,
  onClose,
  onSaved,
}: {
  accounts: Account[];
  categories: Category[];
  initial?: Transaction | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [txType, setTxType] = useState<TxType>(initial?.type || "debit");
  const [amount, setAmount] = useState(initial ? String(toNum(initial.amount)) : "");
  const [accountId, setAccountId] = useState(initial?.account_id || accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState(initial?.category_id || categories[0]?.id || "");
  const [txDate, setTxDate] = useState(initial?.transaction_date || "2026-05-28");
  const [desc, setDesc] = useState(initial?.description || "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAutoSuggest = async () => {
    if (!desc.trim()) return;
    try {
      const res = await api.suggestCategory(desc.trim(), txType);
      if (res.category_id) setCategoryId(res.category_id);
    } catch {
      // ignore suggestion failure
    }
  };

  const handleSubmit = async () => {
    const numAmt = parseFloat(amount);
    if (!numAmt || numAmt <= 0 || !desc.trim() || !accountId) {
      setErr("Please enter a positive amount, description, and account.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (initial) {
        await api.updateTransaction(initial.id, {
          account_id: accountId,
          category_id: categoryId,
          amount: numAmt,
          transaction_date: txDate,
          type: txType,
          description: desc.trim(),
        });
        onSaved("Transaction updated");
      } else {
        await api.createTransaction({
          account_id: accountId,
          category_id: categoryId || null,
          amount: numAmt,
          transaction_date: txDate,
          type: txType,
          description: desc.trim(),
        });
        onSaved("Transaction added");
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to save transaction");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={initial ? "Edit transaction" : "Add transaction"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={busy}>
            <Icon name="check" /> {initial ? "Update" : "Save transaction"}
          </button>
        </>
      }
    >
      {err && <div className="error-banner">{err}</div>}
      <div className="seg" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={txType === "debit" ? "active" : ""}
          onClick={() => setTxType("debit")}
        >
          Expense
        </button>
        <button
          type="button"
          className={txType === "credit" ? "active" : ""}
          onClick={() => setTxType("credit")}
        >
          Income
        </button>
        <button
          type="button"
          className={txType === "transfer" ? "active" : ""}
          onClick={() => setTxType("transfer")}
        >
          Transfer
        </button>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Amount</label>
        <input
          className="input num"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Description</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="e.g. Weekly groceries — FreshMart"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={handleAutoSuggest}
          />
          <button
            type="button"
            className="btn btn--subtle btn--sm"
            onClick={handleAutoSuggest}
            title="Auto-categorize using TF-IDF"
          >
            <Icon name="tag" /> Auto-tag
          </button>
        </div>
      </div>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="field">
          <label>Account</label>
          <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Category</label>
          <select
            className="select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Date</label>
        <input
          className="input"
          type="date"
          value={txDate}
          onChange={(e) => setTxDate(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function CSVImportModal({
  accounts,
  currency,
  onClose,
  onDone,
}: {
  accounts: Account[];
  currency: string;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVImportPreviewResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (f: File | null) => {
    setFile(f);
    setPreview(null);
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const p = await api.previewCsv(f, accountId);
      setPreview(p);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to preview CSV");
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !accountId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.commitCsv(file, accountId);
      onDone(
        `Imported ${res.imported_count} transactions (${res.skipped_duplicates} duplicates skipped)`
      );
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "CSV import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Import Bank Statement (CSV)"
      onClose={onClose}
      width={660}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={handleCommit}
            disabled={!file || !accountId || busy}
          >
            <Icon name="upload" /> Import Rows
          </button>
        </>
      }
    >
      {err && <div className="error-banner">{err}</div>}
      <div className="grid2" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Target Account</label>
          <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>CSV File (date, description, amount)</label>
          <input
            className="input"
            style={{ paddingTop: 8 }}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      {preview && (
        <div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
            Detected {preview.total_rows} rows · Auto-mapped:{" "}
            {Object.entries(preview.detected_mapping)
              .map(([k, v]) => `${k}→"${v}"`)
              .join(", ")}
          </div>
          <div
            style={{
              maxHeight: 240,
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
            }}
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>TF-IDF Category</th>
                  <th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.sample_rows.map((r) => (
                  <tr key={r.row_number}>
                    <td className="num">{r.transaction_date}</td>
                    <td>
                      {r.description}{" "}
                      {r.is_duplicate && <span className="badge badge--black">Duplicate</span>}
                    </td>
                    <td>{r.suggested_category_name || "—"}</td>
                    <td className="right num">
                      {fmtMoney(r.type === "credit" ? toNum(r.amount) : -toNum(r.amount), {
                        sign: true,
                        currency,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
