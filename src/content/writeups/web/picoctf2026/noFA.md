# Flask Session Leak → 2FA Bypass → Flag

## Summary
The app stores authentication state and the 2FA OTP inside the Flask session cookie. Flask cookies are **signed but not encrypted**, so the OTP can be read by decoding the cookie. This allows bypassing 2FA after logging in as admin.

## Recon
From `app.py`:
- On successful login, if `user['two_fa']` is enabled, the server generates a 4‑digit OTP and stores it in the session:
  - `session['otp_secret']`
  - `session['otp_timestamp']`
  - `session['username']`
  - `session['logged'] = 'false'`
- The OTP is supposed to be sent to email, but it is also stored client‑side in the cookie.
- `/` shows the flag only if `session['username'] == 'admin'` and `session['logged'] == 'true'`.

## Vulnerability
Flask’s default session cookie is **client‑side** and only **signed**, not encrypted. Anyone with the cookie can decode the payload and read sensitive values such as `otp_secret`.

## Exploit Steps
1. Dehash the admin password using rockyou wordlist or crackstation from the database and log in as `admin`.
2. The login triggers 2FA and returns a session cookie.
3. Decode the cookie to recover the OTP.
4. Submit the OTP within 120 seconds.
5. After `session['logged'] = 'true'`, open `/` to get the flag.

## Cookie Decode Script (sol.py)
This script decodes the Flask session cookie and prints the JSON payload. It takes only the **first** cookie segment (the session data), fixes padding, decodes it, and zlib‑decompresses it.

```python
import base64
import zlib
import json

# Paste the session cookie here (value from your browser)
cookie = ".eJwty0sKgCAQANC7zFpC0xS9TEhOIvhDp1V091q0ffBuyC1GDODg9HkiMGjU94nHQPpwU9b8RqngJF86OGGMVFxIbhatrVyVZXBNHNUX_JIPJVV4Xkb3HGQ.abP02w.oI9rJ8xlqnOlYSTKMbdhmWuA5lI"

# Flask session cookie format: <payload>.<timestamp>.<signature>
payload = cookie.lstrip(".").split(".")[0]

# Fix base64 padding if needed
payload += "=" * (-len(payload) % 4)

# Decode + decompress
raw = base64.urlsafe_b64decode(payload)
data = zlib.decompress(raw)

# Print the session JSON (contains otp_secret)
print(json.loads(data))
```

## Result
The decoded JSON includes:
- `otp_secret`: the 4‑digit OTP
- `otp_timestamp`
- `username`: `admin`
- `logged`: `false`

Using the OTP from the cookie bypasses 2FA and reveals the flag.

## Fixes
- Store OTP and session state server‑side (DB/Redis).
- Do not place secrets in client‑side sessions.
- Rotate and regenerate sessions during sensitive transitions.
