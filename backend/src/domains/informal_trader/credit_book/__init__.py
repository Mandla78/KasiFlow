"""credit_book -- "who owes you, to the rand".

Customers, credit sales (amount, what they took, when they'll pay back)
and repayments. Repayments are CASH ONLY -- credit is never paid through
PayFast. All money in integer cents via src/shared/finance.

Customer names stay private to the trader; they never appear on a
shared record.
"""
