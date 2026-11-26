"""Excel (.xlsx) and PDF report generation services."""
from io import BytesIO
from pathlib import Path

from fpdf import FPDF
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from app.schemas import ReportAnalyticsSummary, TransactionRead


def generate_excel_report(
    analytics: ReportAnalyticsSummary,
    transactions: list[TransactionRead],
) -> bytes:
    wb = Workbook()
    ws_sum = wb.active
    ws_sum.title = "Summary"

    header_fill = PatternFill(start_color="0052FF", end_color="0052FF", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    ws_sum["A1"] = f"FinanceTrace — {analytics.period_label}"
    ws_sum["A1"].font = Font(size=14, bold=True)
    ws_sum["A2"] = f"Period: {analytics.start_date.isoformat()} to {analytics.end_date.isoformat()}"

    ws_sum.append([])
    ws_sum.append(["Metric", "Value"])
    for cell in ws_sum[4]:
        cell.fill = header_fill
        cell.font = header_font

    ws_sum.append(["Total Income", float(analytics.total_income)])
    ws_sum.append(["Total Expenses", float(analytics.total_expense)])
    ws_sum.append(["Net Savings", float(analytics.net_savings)])
    ws_sum.append(["Transactions", analytics.transaction_count])

    ws_sum.append([])
    ws_sum.append(["Category", "Amount Spent", "Share (%)"])
    cat_hdr_row = ws_sum.max_row
    for cell in ws_sum[cat_hdr_row]:
        cell.fill = header_fill
        cell.font = header_font
    for item in analytics.breakdown:
        ws_sum.append([item.label, float(item.value), item.pct])

    for col in ("A", "B", "C"):
        ws_sum.column_dimensions[col].width = 24

    ws_tx = wb.create_sheet(title="Transactions")
    headers = ["Date", "Account", "Category", "Type", "Description", "Amount"]
    ws_tx.append(headers)
    for cell in ws_tx[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="left")

    for t in transactions:
        ws_tx.append(
            [
                t.transaction_date.isoformat(),
                t.account_name,
                t.category_name,
                t.type,
                t.description or "",
                float(t.signed_amount),
            ]
        )

    for col, width in zip(("A", "B", "C", "D", "E", "F"), (14, 22, 18, 12, 36, 16)):
        ws_tx.column_dimensions[col].width = width

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _ascii_safe(text: str) -> str:
    return (
        text.replace("—", "-")
        .replace("–", "-")
        .replace("−", "-")
        .encode("latin-1", errors="replace")
        .decode("latin-1")
    )


def generate_pdf_report_file(
    output_path: Path,
    title: str,
    analytics: ReportAnalyticsSummary,
    transactions: list[TransactionRead],
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(0, 82, 255)
    pdf.cell(0, 10, _ascii_safe(f"FinanceTrace - {title}"), new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(81, 79, 77)
    pdf.cell(
        0,
        7,
        f"Period: {analytics.start_date.isoformat()} to {analytics.end_date.isoformat()}",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(4)

    # KPI Summary Box
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(8, 7, 7)
    pdf.cell(0, 8, "Executive Summary", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 11)
    kpis = [
        ("Total Income", f"${analytics.total_income:,.2f}"),
        ("Total Expenses", f"${analytics.total_expense:,.2f}"),
        ("Net Savings", f"${analytics.net_savings:,.2f}"),
        ("Transactions", str(analytics.transaction_count)),
    ]
    for label, val in kpis:
        pdf.cell(70, 7, label, border=1)
        pdf.cell(60, 7, val, border=1, new_x="LMARGIN", new_y="NEXT")

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Expense Breakdown by Category", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(70, 7, "Category", border=1)
    pdf.cell(40, 7, "Spent", border=1)
    pdf.cell(30, 7, "Share", border=1, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    for item in analytics.breakdown:
        pdf.cell(70, 7, _ascii_safe(item.label), border=1)
        pdf.cell(40, 7, f"${item.value:,.2f}", border=1)
        pdf.cell(30, 7, f"{item.pct:.1f}%", border=1, new_x="LMARGIN", new_y="NEXT")

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Recent Transactions in Period", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(26, 7, "Date", border=1)
    pdf.cell(36, 7, "Category", border=1)
    pdf.cell(88, 7, "Description", border=1)
    pdf.cell(32, 7, "Amount", border=1, align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    for tx in transactions[:35]:
        pdf.cell(26, 6, tx.transaction_date.isoformat(), border=1)
        pdf.cell(36, 6, _ascii_safe(tx.category_name[:18]), border=1)
        pdf.cell(88, 6, _ascii_safe((tx.description or "")[:46]), border=1)
        sign = "+" if tx.signed_amount >= 0 else "-"
        pdf.cell(
            32,
            6,
            f"{sign}${abs(tx.signed_amount):,.2f}",
            border=1,
            align="R",
            new_x="LMARGIN",
            new_y="NEXT",
        )

    pdf.output(str(output_path))
    return output_path
