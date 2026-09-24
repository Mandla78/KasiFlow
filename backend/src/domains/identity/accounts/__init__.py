"""accounts -- "the user record".

Owns the users table: email, status (unverified / active / locked),
which dashboard the account opens (informal business or supplier),
deactivate and delete.

auth/ and devices/ never write to the users table themselves; they call
accounts' services. One owner per table is how we avoid two features
fighting over the same row.
"""
