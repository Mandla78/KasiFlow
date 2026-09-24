"""devices -- "which phone speaks for you".

After the email is confirmed, the phone makes a private key and sends
us only the PUBLIC key. Everything the trader confirms is signed with
it, so nobody can fake a confirmation.

Signing in on a new phone switches the old phone's key off, so a lost
or stolen phone can't confirm anything.
"""
