"""
/documents/<kind>/<order_id>?exp=..&sig=.. -- the PDF itself, opened from a
link signed by the server that works for 10 minutes (a PDF viewer can't
send our sign-in token). A bad, expired or altered link is a plain 404.

/verify/<number>?s=.. -- where a document's QR code points: anyone holding
an invoice or receipt can check it's genuine. Shows the number, supplier,
date, total and whether it's paid -- never the buyer's details.
"""
from __future__ import annotations

import uuid

from flask import Blueprint, Response, abort, render_template, request

from src.shared.rate_limit.limiter import limiter

from ..services import document_service, pdf

document_pages_bp = Blueprint("document_pages", __name__, template_folder="templates")


@document_pages_bp.get("/documents/<kind>/<order_id>")
@limiter.limit("60 per hour")
def document(kind: str, order_id: str):
    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        abort(404)
    if not document_service.check_link(kind, str(oid), request.args.get("exp", ""), request.args.get("sig", "")):
        abort(404)
    data = document_service.kind_data(kind, oid)
    body = pdf.invoice_pdf(data) if kind == "invoice" else pdf.receipt_pdf(data)
    return Response(body, mimetype="application/pdf", headers={"Content-Disposition": f'inline; filename="{data["number"]}.pdf"'})


@document_pages_bp.get("/verify/<number>")
@limiter.limit("60 per hour")
def verify(number: str):
    return render_template("verify_page.html", doc=document_service.verify(number, request.args.get("s", "")))
