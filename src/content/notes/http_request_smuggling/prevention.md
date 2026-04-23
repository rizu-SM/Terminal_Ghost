# HTTP Request Smuggling — Prevention

---

## Quick Reference

| Control | Prevents | Implementation |
|---------|----------|----------------|
| Use HTTP/2 end-to-end | Eliminates CL/TE ambiguity entirely | Configure both front-end and back-end for HTTP/2 |
| Normalize ambiguous requests | Rejects CL+TE conflict before forwarding | Proxy config: reject or rewrite conflicting headers |
| Disable connection reuse | Eliminates shared buffer between requests | `proxy_http_version 1.0` + `Connection: close` |
| Buffer full request before forwarding | No partial request reaches back-end | `proxy_request_buffering on` |
| Reject `Content-Length` when chunked | Enforces RFC 7230 strictly | Drop CL header if TE: chunked present |
| Validate `Transfer-Encoding` strictly | Blocks TE.TE obfuscation | Reject non-standard TE values |
| Restrict browser fetch capabilities | Blocks CSD via `duplex: half` | CORS policy + server-side request validation |

```nginx
# Minimal nginx hardening against smuggling
proxy_http_version 1.1;
proxy_set_header Connection "";              # enables keep-alive without smuggling risk
proxy_set_header Transfer-Encoding "";       # strips TE before forwarding
proxy_request_buffering on;                  # full body buffered before proxying
proxy_buffering on;
```

---

## Why Prevention Matters 🔓

Understanding prevention is not just a defender's concern — for CTF players and pentesters, knowing **what a hardened server does** tells you exactly **why a target is or isn't vulnerable**. A misconfigured nginx, a missing header strip, or a disabled buffer is the gap you exploit.

**What makes a server vulnerable:**
- ⚠️ Two servers in the chain that disagree on body-length parsing
- ⚠️ Front-end forwards raw `Content-Length` and `Transfer-Encoding` headers without normalization
- ⚠️ Connection reuse (keep-alive) between front-end and back-end — required for poisoning
- ⚠️ Incremental/streaming request processing on the back-end
- ⚠️ No validation of conflicting or obfuscated headers

**What a hardened server does:**
- ✅ Speaks HTTP/2 end-to-end — no CL/TE ambiguity possible
- ✅ Strips or normalizes `Transfer-Encoding` and `Content-Length` before forwarding
- ✅ Rejects requests with both headers present
- ✅ Buffers the full request body before proxying
- ✅ Uses a fresh connection per request (or validates the boundary strictly)

---

## Core Prevention — HTTP/2 End-to-End

The most complete fix. HTTP/2 uses binary framing with explicit length fields — there is no `Content-Length` vs `Transfer-Encoding` ambiguity at the protocol level.

**Why HTTP/2 eliminates the root cause:**

```
HTTP/1.1:  Length determined by Content-Length OR Transfer-Encoding → ambiguity possible
HTTP/2:    Length determined by binary DATA frame size → no ambiguity, no text headers to manipulate
```

**Requirements for end-to-end HTTP/2:**
- Front-end must speak HTTP/2 to clients ✅ (most CDNs already do)
- Front-end must speak HTTP/2 to back-end ✅ (this is the gap — many proxies downgrade to HTTP/1.1)
- Back-end must support HTTP/2 ✅ (nginx, Apache, Node.js, Caddy all support it)

**nginx — enable HTTP/2 to back-end:**

```nginx
upstream backend {
    server 127.0.0.1:8080;
    keepalive 32;
}

server {
    listen 443 ssl http2;

    location / {
        grpc_pass grpc://backend;       # HTTP/2 to back-end via gRPC
    }
}
```

**Caddy (automatic — handles HTTP/2 by default):**

```caddy
# Caddy uses HTTP/2 and normalizes CL/TE automatically
reverse_proxy localhost:8080
```

⚠️ Even with HTTP/2 front-end → HTTP/1.1 back-end (downgrade), smuggling is still possible via H2.CL and H2.TE. True protection requires HTTP/2 **on both sides** of the chain.

---

## Header Normalization

When HTTP/2 end-to-end is not possible, **normalize headers at the front-end** before forwarding — strip or rewrite anything that could cause ambiguity.

**Rule 1 — Strip `Transfer-Encoding` before forwarding:**

```nginx
# nginx
proxy_set_header Transfer-Encoding "";

# Apache (mod_proxy)
RequestHeader unset Transfer-Encoding
```

**Rule 2 — Strip `Content-Length` when `Transfer-Encoding: chunked` is present:**

```nginx
# nginx — conditionally clear CL when TE is chunked
map $http_transfer_encoding $clear_cl {
    ~chunked  "";
    default   $http_content_length;
}
proxy_set_header Content-Length $clear_cl;
```

**Rule 3 — Reject requests with both headers (strictest):**

```nginx
# Return 400 if both CL and TE are present
if ($http_content_length != "" && $http_transfer_encoding != "") {
    return 400;
}
```

**HAProxy normalization:**

```haproxy
http-request deny if { req.hdr_cnt(transfer-encoding) gt 0 } { req.hdr_cnt(content-length) gt 0 }
http-request del-header Transfer-Encoding
```

---

## Disable Connection Reuse

Classic smuggling requires the front-end to **reuse a TCP connection** to the back-end. The poisoned prefix stays in the shared buffer. Forcing a fresh connection per request eliminates the shared state entirely.

**nginx — disable keep-alive to back-end:**

```nginx
proxy_http_version 1.0;           # HTTP/1.0 has no keep-alive by default
# OR keep HTTP/1.1 but explicitly close:
proxy_set_header Connection "close";
```

**Apache mod_proxy — disable keep-alive:**

```apache
ProxyHTTPVersion 1.0
# OR
SetEnv proxy-nokeepalive 1
SetEnv proxy-initial-not-pooled 1
```

**HAProxy — close mode:**

```haproxy
option http-server-close      # closes connection after each response
# OR
option forceclose             # forces close in both directions
```

⚠️ Disabling keep-alive has a **performance cost** — new TCP + TLS handshake per request. Use HTTP/2 or header normalization instead when possible.

---

## Full Request Buffering

When the front-end buffers the **complete request body** before forwarding, the back-end always receives a well-formed, complete request — no partial body leftover, no desync possible.

**nginx — ensure request buffering is on:**

```nginx
proxy_request_buffering on;     # default is on — ensure it's not disabled
client_body_buffer_size 16k;
client_max_body_size 10m;
```

**What `proxy_request_buffering off` enables (avoid this):**

```nginx
# ❌ Dangerous — allows streaming bodies directly to back-end
proxy_request_buffering off;
# Back-end receives body incrementally → pause-based CSD possible
```

**Node.js / Express — buffer body before processing:**

```javascript
// ✅ Secure — full body buffered before any processing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ❌ Vulnerable — streaming body passed through without buffering
app.use((req, res, next) => {
    req.pipe(proxyRequest);   // streams directly → pause-based CSD risk
});
```

---

## Strict Header Validation

Reject non-standard, obfuscated, or duplicate headers used for TE.TE attacks before they reach the back-end.

**Reject obfuscated `Transfer-Encoding` values:**

```nginx
# Block non-standard TE values (xchunked, Chunked, etc.)
map $http_transfer_encoding $invalid_te {
    ~*^chunked$  0;        # only "chunked" is valid per RFC 7230
    ~*^identity$ 0;        # identity also valid but rarely needed
    default      1;        # anything else → reject
}

if ($invalid_te) {
    return 400 "Invalid Transfer-Encoding";
}
```

**Reject duplicate headers (HAProxy):**

```haproxy
http-request deny if { req.hdr_cnt(transfer-encoding) gt 1 }
http-request deny if { req.hdr_cnt(content-length) gt 1 }
```

**Validate `Content-Length` is numeric (Python):**

```python
# ✅ Validate CL is a clean integer before forwarding
def validate_content_length(value):
    try:
        cl = int(value.strip())
        if cl < 0:
            raise ValueError
        return cl
    except (ValueError, AttributeError):
        raise BadRequest("Invalid Content-Length")
```

---

## Preventing Browser-Powered CSD

Client-Side Desync requires the server to process a request before the body is fully received. Prevention targets incremental processing behavior and restricts browser-initiated cross-origin streaming.

**Require full body before processing (Node.js):**

```javascript
// ✅ Secure — wait for complete body before routing
async function readFullBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

app.use(async (req, res, next) => {
    req.rawBody = await readFullBody(req);
    next();
});
```

**Use sync workers — not streaming async workers (Gunicorn):**

```python
# gunicorn.conf.py
worker_class = 'sync'       # ✅ safe — full body before processing
# worker_class = 'gevent'   # ❌ streaming → pause-based CSD possible
```

**Strict CORS policy — block cross-origin credentialed fetch:**

```http
# ✅ Explicit origin allowlist only
Access-Control-Allow-Origin: https://yourdomain.com
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: Content-Type

# ❌ Never use wildcard with credentials:
# Access-Control-Allow-Origin: *
```

**CSP to block post-CSD exfiltration:**

```http
Content-Security-Policy: default-src 'self'; connect-src 'self'
```

---

## Exploitation Workflow (Defender's View)

Understanding the fix at each layer helps identify gaps during a pentest or CTF:

1. **Layer 1 — Protocol** → HTTP/2 end-to-end eliminates CL/TE ambiguity entirely
2. **Layer 2 — Header normalization** → Strip TE before forwarding; reject conflicting CL+TE
3. **Layer 3 — Connection handling** → Disable keep-alive OR validate connection boundary strictly
4. **Layer 4 — Body buffering** → Buffer full request before proxying; no streaming passthrough
5. **Layer 5 — Header validation** → Reject duplicate, obfuscated, or non-RFC TE values
6. **Layer 6 — CSD prevention** → Require full body before processing; sync workers only
7. **Layer 7 — CORS hardening** → Restrict cross-origin credentials; no wildcard origin
8. **Layer 8 — Monitoring** → Alert on requests with both CL and TE headers present

**If any single layer is missing → the attack surface exists.**

---

## Common Misconfigured Patterns

**nginx forwarding TE header unchanged:**

```nginx
# ❌ Vulnerable — TE forwarded as-is to back-end
location / {
    proxy_pass http://backend;
    # Missing: proxy_set_header Transfer-Encoding "";
}

# ✅ Fixed
location / {
    proxy_pass http://backend;
    proxy_set_header Transfer-Encoding "";
    proxy_set_header Connection "";
    proxy_request_buffering on;
    proxy_http_version 1.1;
}
```

**HAProxy without deny rule for dual headers:**

```haproxy
# ❌ Vulnerable — forwards both CL and TE to back-end
backend app
    server web1 127.0.0.1:8080

# ✅ Fixed
frontend http
    http-request deny if { req.hdr_cnt(transfer-encoding) gt 0 } { req.hdr_cnt(content-length) gt 0 }
    http-request del-header Transfer-Encoding

backend app
    option http-server-close
    server web1 127.0.0.1:8080
```

**Node.js proxy streaming without buffering:**

```javascript
// ❌ Vulnerable — pipes request body directly to back-end
app.use((req, res) => {
    const proxy = http.request(backendOptions);
    req.pipe(proxy);    // body streamed without buffering → CSD risk
});

// ✅ Fixed — buffer first, strip TE, rewrite CL
app.use(express.urlencoded({ extended: true }));
app.use((req, res) => {
    const proxy = http.request({
        ...backendOptions,
        headers: {
            ...req.headers,
            'transfer-encoding': undefined,
            'content-length': Buffer.byteLength(req.body).toString()
        }
    });
    proxy.end(req.body);
});
```

**Wildcard CORS enabling CSD from any origin:**

```javascript
// ❌ Vulnerable — any attacker page can send credentialed fetch
app.use(cors({ origin: '*', credentials: true }));

// ✅ Fixed — explicit allowlist
app.use(cors({
    origin: ['https://yourdomain.com'],
    credentials: true
}));
```

---

## CTF & Practical Tips

**Reading prevention config as an attacker:**
- ✅ `Transfer-Encoding: ""` in forwarded headers → front-end strips TE → TE.CL unlikely
- ✅ `Connection: close` in back-end responses → keep-alive disabled → classic smuggling blocked
- ✅ HTTP/2 end-to-end confirmed → no CL/TE surface → pivot to H2 tunneling or CSD
- ✅ Instant response on a hang probe → request buffering on → no pause-based CSD
- ⚠️ `Via: nginx/1.x` in response but TE header still present in proxy → nginx not stripping → likely vulnerable

**What missing controls look like in a CTF lab:**

| Missing Control | Attack Enabled |
|----------------|----------------|
| No `proxy_set_header Transfer-Encoding ""` | TE.CL / TE.TE |
| `proxy_request_buffering off` | Pause-based CSD |
| `Access-Control-Allow-Origin: *` | CSD exfil to any attacker domain |
| HTTP/1.1 between proxy and back-end | Classic CL.TE / TE.CL |
| No duplicate TE header rejection | TE.TE obfuscation |
| Async/streaming worker (gevent) | Pause-based CSD |

---

## Key Takeaways

- ✅ The root cause is protocol ambiguity — HTTP/2 end-to-end eliminates it at the source
- ✅ Header normalization (strip TE, reject CL+TE together) is the most practical fix for HTTP/1.1 stacks
- ✅ Disabling keep-alive eliminates the shared buffer — effective but with performance cost
- ✅ Full request buffering prevents pause-based CSD and all incremental processing attacks
- ✅ Strict TE validation (reject non-standard values, duplicate headers) blocks TE.TE obfuscation
- ✅ As an attacker — missing any one of these controls at any layer is your entry point