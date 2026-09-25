"""
/documents/<kind>/<order_id>?exp=..&sig=.. -- the PDF itself, opened from a
link signed by the server that works for 10 minutes (a PDF viewer can't
send our sign-in token). A bad, expired or altered link is a plain 404.
"""
from __future__ import annotations

import uuid

from flask import Blueprint, Response, abort, request

from src.shared.rate_limit.limiter import limiter

from ..services import document_service, pdf

document_pages_bp = Blueprint("document_pages", __name__)


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
