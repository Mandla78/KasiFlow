"""integration -- "the supplier's system talking to ours".

The API a supplier's ERP calls: push products and stock, receive orders,
confirm deliveries. Authenticated with API keys (scoped, revocable).
Every write is idempotent (src/shared/idempotency) because an ERP
retries when a request times out -- it must never create a product twice.
"""
