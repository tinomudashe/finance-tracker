import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { api } from "../api/client";
import { BaseDatePicker, SegmentedTabs } from "../components/BaseControls";
import { BarChart, resolveBlueBlackColor } from "../components/Charts";
import { Icon } from "../components/Icons";
import { ReportsSkeleton } from "../components/MotionPatterns";
import { PageHeroCard } from "../components/Wallpapers";
import type { ReportAnalyticsSummary, ReportRecord } from "../types";
import { fmtMoney, toNum } from "../utils/format";

export function ReportsView({
  currency,
  wallpaperCss,
  toast,
}: {
  currency: string;
  wallpaperCss?: string;
  toast: (m: string) => void;
}) {
  const [period, setPeriod] = useState<"1m" | "3m" | "6m" | "1y">("3m");
  const [fromDate, setFromDate] = useState("2026-03-01");
  const [toDate, setToDate] = useState("2026-05-31");
  const [analytics, setAnalytics] = useState<ReportAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfReports, setPdfReports] = useState<ReportRecord[]>([]);

  const loadPeriod = async (p: "1m" | "3m" | "6m" | "1y") => {
    setPeriod(p);
    setLoading(true);
    try {
      const data = await api.getReportAnalytics({ period: p });
      setAnalytics(data);
      setFromDate(data.start_date);
      setToDate(data.end_date);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriod("3m");
    api.listReports().then(setPdfReports).catch(() => {});
  }, []);

  const handleGeneratePdf = async () => {
    const rep = await api.generatePdfReport({
      title: `Financial Report (${fromDate} to ${toDate})`,
      report_type: "custom",
      period_start: fromDate,
      period_end: toDate,
    });
    const data = await api.getReportAnalytics({ start_date: fromDate, end_date: toDate });
    setAnalytics(data);
    const list = await api.listReports();
    setPdfReports(list);
    toast(rep.status === "completed" ? "PDF report generated" : "Report queued");
  };

  const handleExportExcel = async () => {
    const sp = new URLSearchParams({ start_date: fromDate, end_date: toDate });
    const token = localStorage.getItem("ft_token");
    const res = await fetch(`/api/reports/export.xlsx?${sp.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FinanceTrace_${fromDate}_${toDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Report exported to Excel (.xlsx)");
  };

  const handleDownloadPdf = async (r: ReportRecord) => {
    const token = localStorage.getItem("ft_token");
    const res = await fetch(`/api/reports/${r.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.title.replace(/\s+/g, "_")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periods: { k: "1m" | "3m" | "6m" | "1y"; l: string }[] = [
    { k: "1m", l: "Last Month" },
    { k: "3m", l: "Last 3 Months" },
    { k: "6m", l: "Last 6 Months" },
    { k: "1y", l: "Last Year" },
  ];

  return (
    <div className="page">
      <PageHeroCard
        icon="reports"
        title="Reports"
        subtitle="Analyse income, spending and savings over time"
        wallpaperCss={wallpaperCss}
        rightSlot={
          <button className="btn btn--ghost btn--sm" onClick={handleExportExcel}>
            <Icon name="download" /> Export to Excel
          </button>
        }
      >
        <button className="btn btn--primary" onClick={handleGeneratePdf}>
          <Icon name="reports" /> Generate PDF Report
        </button>
      </PageHeroCard>

      <div className="card card--pad" style={{ marginBottom: 18 }}>
        <SegmentedTabs
          value={period}
          onValueChange={loadPeriod}
          items={periods.map((p) => ({ value: p.k, label: p.l }))}
          layoutId="reports-period-seg"
          style={{ marginBottom: 16, maxWidth: 580 }}
        />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ width: 205 }}>
            <label>From</label>
            <BaseDatePicker value={fromDate} onChange={setFromDate} ariaLabel="From date" />
          </div>
          <div className="field" style={{ width: 205 }}>
            <label>To</label>
            <BaseDatePicker value={toDate} onChange={setToDate} ariaLabel="To date" />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <ReportsSkeleton key="reports-skeleton" />
        ) : (
          analytics && (
            <div key="reports-content">
              <div className="stat-grid" style={{ marginBottom: 18 }}>
            <div className="stat" style={{ cursor: "default" }}>
              <div className="stat__label" style={{ marginBottom: 10 }}>
                Total Income
              </div>
              <div className="stat__val num" style={{ color: "var(--pos)" }}>
                {fmtMoney(analytics.total_income, { cents: false, currency })}
              </div>
            </div>
            <div className="stat" style={{ cursor: "default" }}>
              <div className="stat__label" style={{ marginBottom: 10 }}>
                Total Expenses
              </div>
              <div className="stat__val num" style={{ color: "var(--ink)" }}>
                {fmtMoney(analytics.total_expense, { cents: false, currency })}
              </div>
            </div>
            <div className="stat" style={{ cursor: "default" }}>
              <div className="stat__label" style={{ marginBottom: 10 }}>
                Net Savings
              </div>
              <div
                className="stat__val num"
                style={{ color: toNum(analytics.net_savings) >= 0 ? "var(--pos)" : "var(--ink)" }}
              >
                {fmtMoney(analytics.net_savings, { sign: true, cents: false, currency })}
              </div>
            </div>
            <div className="stat" style={{ cursor: "default" }}>
              <div className="stat__label" style={{ marginBottom: 10 }}>
                Transactions
              </div>
              <div className="stat__val num">{analytics.transaction_count}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
            <div className="card card--pad">
              <div className="card-head">
                <div className="card-title">Monthly trend</div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--chart-inc)" }} />
                    Income
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--chart-exp)" }} />
                    Expenses
                  </span>
                </div>
              </div>
              <BarChart data={analytics.trend} height={250} currency={currency} />
            </div>

            <div className="card card--pad">
              <div className="card-head">
                <div className="card-title">Category breakdown</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {analytics.breakdown.map((c, idx) => {
                  const barColor = resolveBlueBlackColor(c.color, idx);
                  return (
                    <div key={c.category_id}>
                      <div className="between" style={{ marginBottom: 5 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, fontWeight: 500 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 4, background: barColor }} />
                          {c.label}
                        </span>
                        <span style={{ display: "flex", gap: 10 }}>
                          <span className="muted num" style={{ fontSize: 12.5 }}>
                            {c.pct}%
                          </span>
                          <span className="num cell-strong" style={{ fontSize: 14 }}>
                            {fmtMoney(c.value, { cents: false, currency })}
                          </span>
                        </span>
                      </div>
                      <div className="bar">
                        <i style={{ width: `${Math.min(100, c.pct)}%`, background: barColor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
              </div>
            </div>
          )
        )}
      </AnimatePresence>

      {pdfReports.length > 0 && (
        <div className="card card--pad" style={{ marginTop: 18 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>
            Generated PDF Reports
          </div>
          {pdfReports.map((r) => (
            <div
              key={r.id}
              className="between"
              style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}
            >
              <div>
                <div className="cell-strong">{r.title}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Status: {r.status} · {r.period_start} to {r.period_end}
                </div>
              </div>
              {r.status === "completed" && (
                <button className="btn btn--subtle btn--sm" onClick={() => handleDownloadPdf(r)}>
                  <Icon name="download" /> Download PDF
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
