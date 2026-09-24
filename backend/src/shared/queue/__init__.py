"""queue -- background work.

A small pool of threads. Slow things (sending email, writing audit rows,
fetching images) are enqueue()d so the request returns immediately.
"""
