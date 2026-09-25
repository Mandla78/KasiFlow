"""
Invoices and receipts as PDF (fpdf2: pure Python, built-in fonts).

The built-in fonts cover Latin-1 only; anything else in a name (an emoji,
a rare character) is replaced with "?" rather than breaking the document.
"""
from __future__ import annotations

from fpdf import FPDF

INK = (15, 23, 42)
MUTED = (100, 116, 139)
LINE = (226, 232, 240)
BLUE = (37, 99, 235)


def _t(text) -> str:
    return str(text or "").encode("latin-1", "replace").decode("latin-1")


def _r(cents: int) -> str:
    return f"R{cents / 100:,.2f}"


class _Doc(FPDF):
    def __init__(self, title: str):
        super().__init__(format="A4")
        self.set_auto_page_break(True, margin=18)
        self.set_margins(18, 16, 18)
        self.set_title(title)
        self.set_creator("Akayza")
        self.add_page()

    def brand(self, title: str, number: str, date: str):
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(*INK)
        self.cell(0, 9, "akay", new_x="END")
        self.set_text_color(*BLUE)
        self.cell(0, 9, "za", new_x="LMARGIN", new_y="NEXT")
        self.ln(3)
        self.set_text_color(*INK)
        self.set_font("Helvetica", "B", 16)
        self.cell(0, 9, _t(title), new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*MUTED)
        self.cell(0, 6, _t(f"No. {number}    Date: {date}"), new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

    def block(self, heading: str, rows: list[str]):
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 5, _t(heading.upper()), new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 10.5)
        self.set_text_color(*INK)
        for row in rows:
            if row:
                self.multi_cell(0, 5.5, _t(row), new_x="LMARGIN", new_y="NEXT")
        self.ln(3)

    def rule(self):
        self.set_draw_color(*LINE)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)


def invoice_pdf(d: dict) -> bytes:
    pdf = _Doc(f"{d['title']} {d['number']}")
    pdf.brand(d["title"] + (" (full)" if d["full"] else ""), d["number"], d["date"])
    s = d["supplier"]
    pdf.block("From (supplier)", [
        s["name"] + (f" t/a {s['trading_as']}" if s["trading_as"] and s["trading_as"] != s["name"] else ""),
        s["address"],
        f"VAT number: {s['vat_number']}" if s["vat_number"] else "",
    ])
    if d["buyer"]:
        pdf.block("To (buyer)", [d["buyer"]["name"], d["buyer"]["address"]])
    pdf.block("Order", [f"{d['order_reference']} (placed on Akayza)"])

    widths = (92, 16, 30, 36)
    pdf.set_font("Helvetica", "B", 9.5)
    pdf.set_text_color(*MUTED)
    for w, head in zip(widths, ("Item", "Qty", "Unit price", "Amount")):
        pdf.cell(w, 7, head, align="L" if head == "Item" else "R")
    pdf.ln(7)
    pdf.rule()
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*INK)
    for line in d["lines"]:
        label = line.description + (" *" if line.zero_rated and d["supplier"]["vat_number"] else "")
        pdf.cell(widths[0], 6.5, _t(label[:60]))
        pdf.cell(widths[1], 6.5, str(line.qty), align="R")
        pdf.cell(widths[2], 6.5, _r(line.unit_cents), align="R")
        pdf.cell(widths[3], 6.5, _r(line.total_cents), align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.rule()

    def total(label: str, cents: int, bold: bool = False):
        pdf.set_font("Helvetica", "B" if bold else "", 11 if bold else 10)
        pdf.cell(sum(widths[:3]), 7, _t(label), align="R")
        pdf.cell(widths[3], 7, _r(cents), align="R", new_x="LMARGIN", new_y="NEXT")

    if d["supplier"]["vat_number"]:
        total("Total excluding VAT", d["excl_cents"])
        total("VAT (15%)", d["vat_cents"])
    total("Total", d["total_cents"], bold=True)
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*MUTED)
    notes = []
    if d["supplier"]["vat_number"]:
        notes.append("Prices include VAT. * Zero-rated basic food: no VAT.")
    if d["note"]:
        notes.append(d["note"])
    notes.append(f"Issued by Akayza on behalf of {d['supplier']['trading_as'] or d['supplier']['name']}.")
    for n in notes:
        pdf.multi_cell(0, 5, _t(n), new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())


def receipt_pdf(d: dict) -> bytes:
    pdf = _Doc(f"Payment receipt {d['number']}")
    pdf.brand("Payment receipt", d["number"], d["date"])
    pdf.block("Paid to", [d["supplier"]])
    pdf.block("For order", [d["order_reference"]])
    pdf.block("How it was paid", [d["method"], f"PayFast reference: {d['provider_reference']}" if d["provider_reference"] else ""])
    pdf.rule()
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*INK)
    pdf.cell(0, 10, _t(f"Amount paid: {_r(d['total_cents'])}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(0, 5, "This receipt confirms the payment. The supplier's invoice lists what was bought.", new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())
