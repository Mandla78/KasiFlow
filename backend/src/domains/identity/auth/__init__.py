"""auth -- "proving it's you".

    sign up with email + password (bcrypt, src/shared/security)
    6-digit email verification code
    sign in -> access token + refresh token (JWT)
    continue with Google (verify Google's ID token; link to an existing
    password account only after the password is proven -- never silently)
    forgot password -> one-use link, expires in 30 minutes, same answer
    whether or not the email exists

Uses accounts/ for the user record and devices/ to register the phone's
key on sign-in. Rate limits live here (src/shared/rate_limit).
"""
