import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { api } from "../api/client";
import {
  BaseDatePicker,
  BaseFileDropzone,
  BaseInput,
  BaseSelect,
  CurrencyInput,
  SegmentedTabs,
} from "../components/BaseControls";
import { Icon } from "../components/Icons";
import {
  MorphEditButton,
  MotionTooltip,
  TransactionRowsSkeleton,
} from "../components/MotionPatterns";
import { Badge, Drawer, Modal } from "../components/Shell";
import { PageHeroCard } from "../components/Wallpapers";
import type {
  Account,
  Category,
  CSVImportPreviewResponse,
  Transaction,
  TxType,
} from "../types";
import { fmtDate, fmtMoney, toNum } from "../utils/format";

const PAGE_SIZE = 12;

export function TransactionsView({
  transactions,
  accounts,
  categories,
  currency,
  wallpaperCss,
  refreshKey = 0,
  externalSearch,
  onExternalSearchChange,
  onOpenAdd,
  onChanged,
  onDuplicate,
  onDelete,
  onImported,
}: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  currency: string;
  wallpaperCss?: string;
  refreshKey?: number;
  externalSearch: string;
  onExternalSearchChange: (q: string) => void;
  onOpenAdd: () => void;
  onChanged: (msg: string) => void;
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

  // Infinite scroll state (react-infinite-loading)
  const [rows, setRows] = useState<Transaction[]>(() => transactions.slice(0, PAGE_SIZE));
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(transactions.length);
  const [totalIn, setTotalIn] = useState(() =>
    transactions.filter((t) => t.type === "credit").reduce((s, t) => s + toNum(t.amount), 0)
  );
  const [totalOut, setTotalOut] = useState(() =>
    transactions.filter((t) => t.type !== "credit").reduce((s, t) => s - toNum(t.amount), 0)
  );
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sentinelInView = useInView(sentinelRef, { margin: "160px" });

  const localFallback = useMemo(
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

  const fetchBatch = useCallback(
    async (targetPage: number, reset: boolean) => {
      if (reset) setLoadingInitial(true);
      else setLoadingMore(true);

      try {
        const res = await api.listTransactions({
          q: externalSearch.trim() || undefined,
          type,
          account_id: acct,
          category_id: cat,
          page: targetPage,
          limit: PAGE_SIZE,
        });
        setRows((prev) => {
          if (reset) return res.transactions;
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...res.transactions.filter((t) => !seen.has(t.id))];
        });
        setPage(targetPage);
        setTotalCount(res.total);
        setTotalIn(toNum(res.total_in));
        setTotalOut(toNum(res.total_out));
      } catch {
        const sliceEnd = targetPage * PAGE_SIZE;
        setRows(localFallback.slice(0, sliceEnd));
        setPage(targetPage);
        setTotalCount(localFallback.length);
      } finally {
        setLoadingInitial(false);
        setLoadingMore(false);
      }
    },
    [externalSearch, type, acct, cat, localFallback]
  );

  // Reset to page 1 on filter or workspace changes
  useEffect(() => {
    fetchBatch(1, true);
  }, [externalSearch, type, acct, cat, refreshKey, fetchBatch]);

  const hasMore = rows.length < totalCount;

  // Trigger next page when sentinel scrolls into view
  useEffect(() => {
    if (sentinelInView && hasMore && !loadingInitial && !loadingMore) {
      fetchBatch(page + 1, false);
    }
  }, [sentinelInView, hasMore, loadingInitial, loadingMore, page, fetchBatch]);

  return (
    <div className="page">
      <PageHeroCard
        icon="transactions"
        title="Transactions"
        subtitle={
          <>
            Showing {rows.length} of {totalCount} transactions ·{" "}
            <span className="num" style={{ fontWeight: 700, color: "var(--pos)" }}>
              {fmtMoney(totalIn, { cents: false, currency })}
            </span>{" "}
            in,{" "}
            <span className="num" style={{ fontWeight: 700, color: "var(--ink)" }}>
              {fmtMoney(totalOut, { cents: false, currency })}
            </span>{" "}
            out
          </>
        }
        wallpaperCss={wallpaperCss}
        rightSlot={
          <button className="btn btn--ghost btn--sm" onClick={() => setCsvOpen(true)}>
            <Icon name="upload" /> Import CSV
          </button>
        }
      >
        <button className="btn btn--primary" onClick={onOpenAdd}>
          <Icon name="plus" /> Add Transaction
        </button>
      </PageHeroCard>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div className="search">
          <Icon name="search" />
          <input
            placeholder="Search description, category, or account…"
            value={externalSearch}
            onChange={(e) => onExternalSearchChange(e.target.value)}
          />
          {externalSearch && (
            <button
              type="button"
              className="sf-search__clear"
              onClick={() => onExternalSearchChange("")}
              aria-label="Clear filter"
            >
              <Icon name="close" />
            </button>
          )}
        </div>

        <BaseSelect
          width={165}
          ariaLabel="Filter by transaction type"
          value={type}
          onValueChange={setType}
          options={[
            { value: "all", label: "All types" },
            { value: "income", label: "Income" },
            { value: "expense", label: "Expense" },
            { value: "transfer", label: "Transfer" },
          ]}
        />

        <BaseSelect
          width={210}
          ariaLabel="Filter by account"
          value={acct}
          onValueChange={setAcct}
          options={[
            { value: "all", label: "All accounts" },
            ...accounts.map((a) => ({ value: a.id, label: a.name, sublabel: a.account_type })),
          ]}
        />

        <BaseSelect
          width={200}
          ariaLabel="Filter by category"
          value={cat}
          onValueChange={setCat}
          options={[
            { value: "all", label: "All categories" },
            ...categories.map((c) => ({ value: c.id, label: c.name, sublabel: c.type })),
          ]}
        />
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
                <th style={{ width: 125 }} />
              </tr>
            </thead>
            <tbody>
              {loadingInitial ? (
                <TransactionRowsSkeleton rows={6} />
              ) : (
                rows.map((t, idx) => {
                  const pos = toNum(t.signed_amount) >= 0;
                  return (
                    <motion.tr
                      key={t.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.16,
                        delay: Math.min(0.18, (idx % PAGE_SIZE) * 0.018),
                      }}
                      onClick={() => setDetail(t)}
                    >
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
                          <MorphEditButton
                            morphId={`tx-${t.id}`}
                            title="Edit transaction"
                            tooltip="Edit transaction"
                            width={520}
                          >
                            {(close) => (
                              <TransactionEditorBody
                                accounts={accounts}
                                categories={categories}
                                currency={currency}
                                initial={t}
                                onCancel={close}
                                onSaved={(msg) => {
                                  close();
                                  onChanged(msg);
                                }}
                              />
                            )}
                          </MorphEditButton>

                          <MotionTooltip content="Duplicate transaction">
                            <button
                              type="button"
                              className="mini-btn"
                              onClick={() => onDuplicate(t)}
                              aria-label="Duplicate transaction"
                            >
                              <Icon name="copy" />
                            </button>
                          </MotionTooltip>

                          <MotionTooltip content="Delete transaction">
                            <button
                              type="button"
                              className="mini-btn danger"
                              onClick={() => setConfirmDel(t)}
                              aria-label="Delete transaction"
                            >
                              <Icon name="trash" />
                            </button>
                          </MotionTooltip>
                        </span>
                      </td>
                    </motion.tr>
                  );
                })
              )}

              {loadingMore && <TransactionRowsSkeleton rows={3} />}

              {!loadingInitial && rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 42, color: "var(--ink-3)" }}>
                    No transactions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div ref={sentinelRef} className="mp-infinite-sentinel">
          {loadingMore
            ? "Loading more transactions…"
            : hasMore
            ? `Scroll to load more (${rows.length} of ${totalCount})`
            : rows.length > 0
            ? `All ${totalCount} transactions loaded`
            : ""}
        </div>
      </div>

      {detail && (
        <Drawer
          title="Transaction details"
          onClose={() => setDetail(null)}
          footer={
            <>
              <MorphEditButton
                morphId={`tx-drawer-${detail.id}`}
                title="Edit transaction"
                tooltip="Edit transaction"
                buttonLabel="Edit"
                width={520}
              >
                {(close) => (
                  <TransactionEditorBody
                    accounts={accounts}
                    categories={categories}
                    currency={currency}
                    initial={detail}
                    onCancel={close}
                    onSaved={(msg) => {
                      close();
                      setDetail(null);
                      onChanged(msg);
                    }}
                  />
                )}
              </MorphEditButton>
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

function TransactionEditorBody({
  accounts,
  categories,
  currency = "USD",
  initial,
  onCancel,
  onSaved,
}: {
  accounts: Account[];
  categories: Category[];
  currency?: string;
  initial?: Transaction | null;
  onCancel: () => void;
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
    <>
      <div className="mp-morph-panel__body">
        {err && <div className="error-banner">{err}</div>}
        <SegmentedTabs
          value={txType}
          onValueChange={setTxType}
          items={[
            { value: "debit", label: "Expense" },
            { value: "credit", label: "Income" },
            { value: "transfer", label: "Transfer" },
          ]}
          layoutId={`tx-editor-seg-${initial?.id || "new"}`}
          style={{ marginBottom: 16 }}
        />

        <div className="field" style={{ marginBottom: 14 }}>
          <label>Amount</label>
          <CurrencyInput value={amount} onValueChange={setAmount} currency={currency} />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>Description</label>
          <div style={{ display: "flex", gap: 8 }}>
            <BaseInput
              placeholder="e.g. Weekly groceries — FreshMart"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={handleAutoSuggest}
            />
            <MotionTooltip content="Auto-categorize using TF-IDF">
              <button
                type="button"
                className="btn btn--subtle btn--sm"
                style={{ height: 46 }}
                onClick={handleAutoSuggest}
              >
                <Icon name="sparkles" /> Auto-tag
              </button>
            </MotionTooltip>
          </div>
        </div>

        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Account</label>
            <BaseSelect
              value={accountId}
              onValueChange={setAccountId}
              options={accounts.map((a) => ({
                value: a.id,
                label: a.name,
                sublabel: a.account_type,
              }))}
            />
          </div>
          <div className="field">
            <label>Category</label>
            <BaseSelect
              value={categoryId}
              onValueChange={setCategoryId}
              options={categories.map((c) => ({
                value: c.id,
                label: c.name,
                sublabel: c.type,
              }))}
            />
          </div>
        </div>

        <div className="field">
          <label>Date</label>
          <BaseDatePicker value={txDate} onChange={setTxDate} ariaLabel="Transaction date" />
        </div>
      </div>

      <div className="mp-morph-panel__foot">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" onClick={handleSubmit} disabled={busy}>
          <Icon name="check" /> {initial ? "Update" : "Save transaction"}
        </button>
      </div>
    </>
  );
}

export function TransactionFormModal({
  accounts,
  categories,
  currency = "USD",
  initial,
  onClose,
  onSaved,
}: {
  accounts: Account[];
  categories: Category[];
  currency?: string;
  initial?: Transaction | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  return (
    <Modal title={initial ? "Edit transaction" : "Add transaction"} onClose={onClose}>
      <div style={{ margin: "-24px" }}>
        <TransactionEditorBody
          accounts={accounts}
          categories={categories}
          currency={currency}
          initial={initial}
          onCancel={onClose}
          onSaved={onSaved}
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
          <BaseSelect
            value={accountId}
            onValueChange={setAccountId}
            options={accounts.map((a) => ({
              value: a.id,
              label: a.name,
              sublabel: a.account_type,
            }))}
          />
        </div>
        <div className="field">
          <label>CSV Statement File</label>
          <BaseFileDropzone file={file} onFileChange={handleFile} />
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
