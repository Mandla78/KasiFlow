"""supplier -- "the supplier side".

Suppliers don't use the app for the hackathon: they are connected
through their own systems (ERP) via integration/.

    supplier_profile/   who they are, where they deliver, how they take
                        payment (PayFast, cash on delivery, or both)
    catalogue/          their products, prices, stock, photos
    integration/        the API their ERP calls, with API keys

Tables live in the "supplier" database schema.
"""
