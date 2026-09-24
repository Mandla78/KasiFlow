"""shared -- TOOLS any domain can use, that know nothing about the business.

    finance/        money: integer cents, rounding, allocation, receipts
    idempotency/    a retried request lands once (offline sync, ERP retries)
    audit/          "who did what, when, from where"
    email/          sending email (fake provider in development)
    notifications/  in-app notification events
    queue/          run slow work in the background
    rate_limit/     "too many attempts, try later"
    security/       password hashing and rules
    validation/     email / phone / business-name clean-up
    cache/, logging/, monitoring/, scheduling/, helpers/, constants/

THE RULE: shared/ NEVER imports from src/domains. If a tool needs to
know what a "credit sale" is, it belongs in a domain, not here.
"""
