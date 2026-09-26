"""
Invoices and receipts as PDF (fpdf2: pure Python, built-in fonts; QR codes
with segno).

Layout: brand + title + number/date, the QR code top right ("scan to check
this document is genuine"), then seller and buyer side by side, the order
facts, the lines, the totals, and the notes a tax invoice needs.

The built-in fonts cover Latin-1 only; anything else in a name (an emoji,
a rare character) is replaced with "?" rather than breaking the document.
"""
from __future__ import annotations

import segno
from fpdf import FPDF

INK = (15, 23, 42)
MUTED = (100, 116, 139)
LINE = (226, 232, 240)
BLUE = (37, 99, 235)
GREEN = (5, 150, 105)
QR_SIZE = 30


def _t(text) -> str:
    return str(text or "").encode("latin-1", "replace").decode("latin-1")


def _r(cents: int) -> str:
    return f"R{cents / 100:,.2f}"


def _draw_qr(pdf: FPDF, url: str, x: float, y: float, size: float) -> None:
    """The QR as vector squares straight from its matrix: sharp at any zoom
    and in any PDF viewer (no image format to get wrong)."""
    matrix = list(segno.make(url, error="m").matrix)
    border = 2
    n = len(matrix) + 2 * border
    cell = size / n
    pdf.set_fill_color(255, 255, 255)
    pdf.rect(x, y, size, size, style="F")
    pdf.set_fill_color(*INK)
    for r, row in enumerate(matrix):
        for c, dark in enumerate(row):
            if dark:
                pdf.rect(x + (c + border) * cell, y + (r + border) * cell, cell + 0.01, cell + 0.01, style="F")


class _Doc(FPDF):
    def __init__(self, title: str):
        super().__init__(format="A4")
        self.set_auto_page_break(True, margin=18)
        self.set_margins(16, 14, 16)
        self.set_title(title)
        self.set_creator("Akayza")
        self.add_page()

    def header_block(self, title: str, number: str, date: str, verify_url: str, badge: str | None = None):
        top = self.get_y()
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(*INK)
        self.cell(self.get_string_width("akay"), 9, "akay")
        self.set_text_color(*BLUE)
        self.cell(0, 9, "za", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)
        self.set_text_color(*INK)
        self.set_font("Helvetica", "B", 17)
        self.cell(0, 9, _t(title), new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*MUTED)
        self.cell(0, 5.5, _t(f"No. {number}"), new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 5.5, _t(f"Date: {date}"), new_x="LMARGIN", new_y="NEXT")
        if badge:
            self.set_font("Helvetica", "B", 10)
            self.set_text_color(*GREEN)
            self.cell(0, 6, _t(badge), new_x="LMARGIN", new_y="NEXT")
        # The QR, top right: opens our "is this genuine?" page.
        x = self.w - self.r_margin - QR_SIZE
        _draw_qr(self, verify_url, x, top, QR_SIZE)
        self.set_xy(x - 4, top + QR_SIZE)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MUTED)
        self.multi_cell(QR_SIZE + 8, 3.2, "Scan to check this\ndocument is genuine", align="C")
        self.set_xy(self.l_margin, max(self.get_y(), top + QR_SIZE + 8) + 2)
        self.rule()

    def two_columns(self, left_title: str, left: list[str], right_title: str, right: list[str]):
        col = (self.w - self.l_margin - self.r_margin - 8) / 2
        top = self.get_y()
        self._column(self.l_margin, top, col, left_title, left)
        left_end = self.get_y()
        self._column(self.l_margin + col + 8, top, col, right_title, right)
        self.set_xy(self.l_margin, max(left_end, self.get_y()) + 3)

    def _column(self, x: float, y: float, width: float, title: str, rows: list[str]):
        self.set_xy(x, y)
        self.set_font("Helvetica", "B", 8.5)
        self.set_text_color(*MUTED)
        self.cell(width, 5, _t(title.upper()), new_x="LEFT", new_y="NEXT")
        first = True
        for row in rows:
            if not row:
                continue
            self.set_x(x)
            self.set_font("Helvetica", "B" if first else "", 10.5 if first else 9.5)
            self.set_text_color(*INK)
            self.multi_cell(width, 5, _t(row), new_x="LEFT", new_y="NEXT")
            first = False

    def facts(self, rows: list[tuple[str, str]]):
        self.set_font("Helvetica", "", 9.5)
        for label, value in rows:
            if not value:
                continue
            self.set_text_color(*MUTED)
            self.cell(34, 5.5, _t(label))
            self.set_text_color(*INK)
            self.multi_cell(0, 5.5, _t(value), new_x="LMARGIN", new_y="NEXT")
        self.ln(2)
        self.rule()

    def rule(self):
        self.set_draw_color(*LINE)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

    def notes(self, lines: list[str]):
        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(*MUTED)
        for n in lines:
            if n:
                self.multi_cell(0, 4.5, _t(n), new_x="LMARGIN", new_y="NEXT")


def _seller_rows(s: dict) -> list[str]:
    return [
        s["name"],
        f"Trading as {s['trading_as']}" if s.get("trading_as") and s["trading_as"] != s["name"] else "",
        s["address"],
        f"VAT number: {s['vat_number']}" if s.get("vat_number") else "",
        f"Email: {s['email']}" if s.get("email") else "",
        f"Phone: {s['phone']}" if s.get("phone") else "",
    ]


def _buyer_rows(b: dict) -> list[str]:
    cipc = ""
    if b.get("cipc_number"):
        cipc = f"CIPC: {b['cipc_number']}" + (f" ({b['cipc_name']}, verified)" if b.get("cipc_verified") else "")
    return [
        b["business"],
        b.get("owner") or "",
        b.get("address") or "",
        cipc,
        f"Email: {b['email']}" if b.get("email") else "",
        f"Phone: {b['phone']}" if b.get("phone") else "",
    ]


def invoice_pdf(d: dict) -> bytes:
    pdf = _Doc(f"{d['title']} {d['number']}")
    pdf.header_block(d["title"], d["number"], d["date"], d["verify_url"], badge="PAID" if d.get("paid") else None)
    pdf.two_columns("From (supplier)", _seller_rows(d["supplier"]), "To (buyer)", _buyer_rows(d["buyer"]))
    o = d["order"]
    pdf.facts([
        ("Order", f"{o['reference']} (placed {o['placed']})"),
        ("Fulfilment", o["fulfilment"]),
        ("Payment", o["payment"]),
        ("Proof of payment", o["evidence"]),
    ])

    widths = (96, 14, 32, 36)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*MUTED)
    for w, head in zip(widths, ("Item", "Qty", "Unit price", "Amount")):
        pdf.cell(w, 7, head, align="L" if head == "Item" else "R")
    pdf.ln(7)
    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(*INK)
    registered = bool(d["supplier"].get("vat_number"))
    for line in d["lines"]:
        label = line.description + (" *" if line.zero_rated and registered else "")
        pdf.cell(widths[0], 6.5, _t(label[:62]))
        pdf.cell(widths[1], 6.5, str(line.qty), align="R")
        pdf.cell(widths[2], 6.5, _r(line.unit_cents), align="R")
        pdf.cell(widths[3], 6.5, _r(line.total_cents), align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.rule()

    def total(label: str, cents: int, bold: bool = False):
        pdf.set_font("Helvetica", "B" if bold else "", 11.5 if bold else 10)
        pdf.set_text_color(*INK)
        pdf.cell(sum(widths[:3]), 7, _t(label), align="R")
        pdf.cell(widths[3], 7, _r(cents), align="R", new_x="LMARGIN", new_y="NEXT")

    if registered:
        total("Total excluding VAT", d["excl_cents"])
        total("VAT (15%)", d["vat_cents"])
    total("Total", d["total_cents"], bold=True)
    pdf.ln(5)
    pdf.notes([
        "Prices include VAT. * Zero-rated basic food: no VAT." if registered else "",
        d.get("note") or "",
        f"Issued by Akayza on behalf of {d['supplier']['trading_as'] or d['supplier']['name']}.",
        "Check this document at the link in the QR code; a copy that doesn't match there isn't genuine.",
    ])
    return bytes(pdf.output())


def receipt_pdf(d: dict) -> bytes:
    pdf = _Doc(f"Payment receipt {d['number']}")
    pdf.header_block("Payment receipt", d["number"], d["date"], d["verify_url"], badge="PAID")
    pdf.two_columns("Paid by", _buyer_rows(d["buyer"]), "Paid to (supplier)", _seller_rows(d["supplier"]))
    o = d["order"]
    pdf.facts([
        ("For order", f"{o['reference']} (placed {o['placed']})"),
        ("Fulfilment", o["fulfilment"]),
        ("Paid with", d["method"]),
        ("PayFast ref.", d.get("provider_reference") or ""),
        ("Paid on", d["date"]),
        ("Proof", o["evidence"]),
    ])
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*INK)
    pdf.cell(0, 11, _t(f"Amount paid: {_r(d['total_cents'])}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.notes([
        "This receipt confirms the payment. The supplier's invoice lists what was bought.",
        "Akayza never sees or stores card details: digital payments are made on PayFast's secure page.",
        "Check this receipt at the link in the QR code.",
    ])
    return bytes(pdf.output())
