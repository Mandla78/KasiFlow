"""
Business's own audit event vocabulary -- domains/business/stock_order
is the publisher today (a business role action -- building and
submitting a cart), Security's audit service is the consumer, same
"both import from here, neither imports the other" shape as every
other domain's event_types file.

Named business.py, not stock_order.py -- events are organized by
WHICH ROLE the action belongs to (matching supplier.py's own
precedent), not by the specific feature name. A stock order is a
business-role action; a future business-side feature would add its
own events to this SAME file, not get a new one.

ORDER_LIMIT_EXCEEDED matters beyond a rejected request: repeated
attempts from the same account are a real, security-relevant signal
worth being able to query later (a business probing where the
boundary sits), not just a 409 response that vanishes the moment the
request finishes.

ORDER_ACCESS_DENIED -- same reasoning, applied to get_order_detail's
own IDOR protection. That lookup is already correctly scoped by both
business_id and supplier_profile_id (a business genuinely cannot view
another business's own order), but until this was added, a rejection
there left no trace at all. Repeated attempts from the same account
requesting order ids that aren't theirs is exactly the kind of
pattern worth being able to find later.
"""
from __future__ import annotations

import enum


class BusinessAuditEvent(str, enum.Enum):
    ORDER_SUBMITTED = "business.order_submitted"
    ORDER_LIMIT_EXCEEDED = "business.order_limit_exceeded"
    CHECKOUT_RATE_LIMITED = "business.checkout_rate_limited"
    ORDER_ACCESS_DENIED = "business.order_access_denied"
    ORDER_CANCELLED = "business.order_cancelled"
    # Business profile (informal_trader/business_profile)
    BUSINESS_PROFILE_SAVED = "business.profile_saved"
    CIPC_CHECKED = "business.cipc_checked"
    CIPC_CHECK_LIMITED = "business.cipc_check_limited"
    PROFILE_IMAGE_UPLOADED = "business.profile_image_uploaded"
    PROFILE_IMAGE_REMOVED = "business.profile_image_removed"
    PROFILE_IMAGE_REJECTED = "business.profile_image_rejected"
    # Credit book (informal_trader/credit_book): ids and amounts only, never names or phones
    CREDIT_ENTRY_ADDED = "credit.entry_added"
    CREDIT_PAYMENT_RECORDED = "credit.payment_recorded"
    CREDIT_ENTRY_CORRECTED = "credit.entry_corrected"
    CREDIT_ENTRY_CANCELLED = "credit.entry_cancelled"
    CREDIT_CUSTOMER_PHONE_CHANGED = "credit.customer_phone_changed"
    CREDIT_CUSTOMER_DELETED = "credit.customer_deleted"
    CREDIT_ENTRY_BINNED = "credit.entry_binned"
    CREDIT_ENTRY_RESTORED = "credit.entry_restored"
    # Jobs (informal_trader/jobs): ids, amounts, outcomes, photo hashes; never client names or phones
    JOB_CREATED = "job.created"
    JOB_STAGE_PHOTO_ADDED = "job.stage_photo_added"
    JOB_SIGN_OFF_SENT = "job.sign_off_sent"
    JOB_SIGN_OFF_ANSWERED = "job.sign_off_answered"
    JOB_SIGN_OFF_REFUSED = "job.sign_off_refused"
    JOB_DONE = "job.done"
    JOB_BINNED = "job.binned"
    JOB_RESTORED = "job.restored"

    BUILDER_PROFILE_SAVED = "builder.profile_saved"
    BUILDER_VISIBILITY_CHANGED = "builder.visibility_changed"
    BUILDER_SAVED = "builder.saved"
    BUILDER_UNSAVED = "builder.unsaved"
    BUILDER_BLOCKED = "builder.blocked"
    BUILDER_REPORTED = "builder.reported"
    PARTNER_INVITED = "partner.invited"
    PARTNER_ANSWERED = "partner.answered"
    PARTNER_PAYMENT_RECORDED = "partner.payment_recorded"
    PARTNER_PAYMENT_ANSWERED = "partner.payment_answered"
    PARTNER_LIMITED = "partner.limited"
    HELP_POST_CREATED = "help_post.created"
    HELP_POST_INTERESTED = "help_post.interested"
    HELP_POST_PICKED = "help_post.picked"
    HELP_POST_CLOSED = "help_post.closed"
