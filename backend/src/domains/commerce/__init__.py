"""commerce -- "a trader and a supplier doing business".

Separate from informal_trader and supplier because an order belongs to
neither side alone.

    orders/     cart -> order -> delivery or collection
    payments/   PayFast (digital) and cash on delivery

Tables live in the "commerce" database schema.
"""
