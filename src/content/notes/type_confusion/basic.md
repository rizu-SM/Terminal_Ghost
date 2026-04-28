# Type Confusion — Basics

---

## Quick Reference

| Language | Vulnerable | Safe | Example Bypass |
|----------|-----------|------|----------------|
| PHP | `==` | `===` | `"0e1234" == "0e5678"` → `true` |
| PHP | `in_array()` | `in_array($v, $arr, true)` | `0 == "admin"` → `true` |
| JavaScript | `==` | `===` | `0 == false` → `true` |
| JavaScript | `parseInt()` | `Number()` | `parseInt("10abc")` → `10` |
| Python | `assert` | explicit type check | `assert 0 == False` → passes |
| Ruby | `=~` | `\A...\z` anchors | regex bypassed by newline |

```php
-- PHP magic hash bypass (both are "0e..." → treated as 0.0 in scientific notation)
"0e462097431906509019562988736854" == "0e830400451993494058024219903391"  → true
md5("240610708") == md5("QNKCDZO")  → true   ← both start with 0e

-- JS type coercion classics
0 == false          → true
"" == false         → true
null == undefined   → true
[] == false         → true
[] == ![]           → true   ← both sides coerce to 0
```

---

## What is Type Confusion? 🔓

Type confusion happens when a program **compares or uses a value of one type as if it were another** — and the language's implicit conversion rules produce an unexpected result. The attacker supplies a value whose *type* causes comparison logic to evaluate differently than the developer intended.

**Impact:**
- 🔴 Authentication bypass — `password == hash` evaluates to `true` with wrong input
- 🔴 Authorization bypass — admin checks pass with unexpected value types
- 🔴 Logic bypass — numeric comparisons broken by string/array/boolean coercion
- 🔴 Code execution — object injection via type coercion in deserialization
- ⚠️ Severity depends on what the confused comparison guards — auth checks are critical

**The core idea:**

```php
// Developer intends: check if submitted password matches stored hash
if ($submitted == $stored_hash) {
    grant_access();
}

// Attacker submits: "0e1234567890"
// Stored hash is:   "0e9876543210"
// PHP loose comparison: both treated as 0.0 in scientific notation
// 0.0 == 0.0 → true → access granted without knowing the password
```

---

## PHP Type Juggling

PHP is the most type-confused language in web security. The `==` operator performs **type juggling** — silently converting operands to a common type before comparing.

### The Loose Comparison Table

```php
var_dump(0     == "a");      // true  ← string "a" converts to int 0
var_dump(0     == "0");      // true
var_dump(0     == false);    // true
var_dump(0     == null);     // true
var_dump(0     == "");       // true  (PHP 7) / false (PHP 8 — fixed!)
var_dump(1     == "1abc");   // true  ← "1abc" converts to int 1
var_dump(100   == "1e2");    // true  ← "1e2" = 100 in scientific notation
var_dump("1"   == "01");     // true  ← both convert to int 1
var_dump("10"  == "1e1");    // true  ← "1e1" = 10.0
var_dump(true  == "anything");// true ← any non-empty string == true
var_dump(false == "");        // true
var_dump(false == "0");       // true
var_dump(false == null);      // true
var_dump(false == 0);         // true
var_dump(false == []);        // true ← empty array == false
var_dump(null  == "");        // true
var_dump(null  == "0");       // false ← null != "0"
```

⚠️ PHP 8 fixed `0 == "a"` (now `false`) but many other juggling behaviors remain. Always check PHP version.

### Magic Hashes — 0e Bypass

Any string starting with `0e` followed by digits is treated as `0.0` (scientific notation) in loose comparison:

```php
// Both MD5 hashes start with "0e" → both equal 0.0 → equal to each other
md5("240610708")  = "0e462097431906509019562988736854"
md5("QNKCDZO")   = "0e830400451993494058024219903391"
"0e462097..." == "0e830400..."  → true

// SHA1 magic strings
sha1("aaroZmOk") = "0e66507019969427134894567494305185566735"
sha1("aaK1STfY") = "0e76658526655756207688271159624026011393"

// SHA256 magic strings
"0e1137126905"  → sha256 starts with 0e...
```

**Attack scenario:**

```php
// ❌ Vulnerable login — hash comparison with ==
$hash = md5($_POST['password']);
if ($hash == $stored_hash) { ... }

// If stored_hash = "0e462097431906509019562988736854"
// Submit password = "QNKCDZO" → md5 = "0e830400..." → 0.0 == 0.0 → bypass ✅
```

### Type Juggling in Switch Statements

```php
// ❌ Vulnerable — switch uses loose comparison
switch ($role) {
    case "admin":  grantAdmin(); break;
    case "user":   grantUser();  break;
    case 0:        grantGuest(); break;  // ← 0 == "admin" is false, but...
}

// Input: role=0
// 0 == "admin" → false (PHP 8) but in PHP 7: true if "admin" converts to 0
// Input: role=true
// true == "admin" → true in all PHP versions → grantAdmin() fires
```

### in_array() Without Strict Mode

```php
// ❌ Vulnerable — in_array uses loose comparison by default
$whitelist = [1, 2, 3, "admin"];
if (in_array($_GET['role'], $whitelist)) {
    grant_access();
}

// Input: role=0      → 0 == 1? No. 0 == "admin"? YES (PHP 7) → bypass
// Input: role=true   → true == 1? YES → bypass
// Input: role="0e0"  → "0e0" == 1? No. "0e0" == "admin"? No. But "0e0" == 0 if 0 is in list

// ✅ Fixed
if (in_array($_GET['role'], $whitelist, true)) { ... }  // strict = third param
```

### Array vs String Comparisons

```php
// Arrays are greater than any string in loose comparison
var_dump([] > "anything");   // true
var_dump([] == 0);           // true
var_dump([] == false);       // true
var_dump([] == null);        // true

// Attack: if password check uses strpos or similar
if (strcmp($_POST['password'], $stored) == 0) { ... }
// Input: password[] (array) → strcmp(array, string) returns null → null == 0 → true ✅
```

### strcmp() / strcasecmp() Null Bypass

```php
// ❌ Vulnerable — strcmp returns null when array passed
if (strcmp($_POST['pass'], $secret) == 0) {
    grant_access();
}
// POST: pass[]=anything → strcmp(array, string) = null → null == 0 → true
```

---

## JavaScript Type Coercion

JavaScript's `==` (abstract equality) performs coercion through a complex algorithm. `===` (strict equality) never coerces.

### Coercion Rules — The Dangerous Ones

```javascript
// Boolean coercion
0         == false    // true
""        == false    // true
[]        == false    // true  ← [] → "" → 0 → false
null      == false    // FALSE ← null only equals undefined
undefined == false    // FALSE

// Null / undefined
null      == undefined  // true
null      == 0          // false
null      == ""         // false
undefined == 0          // false

// String to number
"1"    == 1        // true
"01"   == 1        // true
"1e0"  == 1        // true
" "    == 0        // true  ← whitespace string → 0
""     == 0        // true
"abc"  == 0        // true in old JS, false in modern
"0x10" == 16       // true  ← hex string parsed

// Object coercion
[]         == 0    // true  ← [] → "" → 0
[[]]       == 0    // true
["0"]      == 0    // true
[null]     == ""   // true
[undefined]== ""   // true
[] == ![]          // true  ← both sides become 0
```

### parseInt() Truncation

```javascript
// parseInt stops at first non-numeric character
parseInt("10abc")     // 10   ← not NaN
parseInt("0x10")      // 16   ← hex parsed
parseInt("010")       // 8    ← octal in old engines
parseInt(" 10 ")      // 10   ← whitespace trimmed
parseInt("10.9")      // 10   ← decimal truncated
parseInt("")          // NaN
parseInt("abc")       // NaN

// Attack: if port/ID validation uses parseInt
// Input: "8080abc" → parseInt → 8080 → passes check → actual request to "8080abc"
```

### NaN Comparisons

```javascript
NaN == NaN      // false  ← NaN is never equal to itself
NaN === NaN     // false
NaN != NaN      // true   ← use this to detect NaN
typeof NaN      // "number" ← NaN is a number type!

// Attack: bypass numeric range check
if (userInput > 0 && userInput < 100) { ... }
// Input: NaN → NaN > 0 = false → condition fails
// But: if check is inverted:
if (!(userInput < 0) && !(userInput > 100)) { ... }
// NaN < 0 = false → !false = true
// NaN > 100 = false → !false = true
// Both pass → NaN gets through
```

### JSON Parsing Type Confusion

```javascript
// Attacker controls JSON body
// App expects: {"role": "user"}
// Attacker sends: {"role": true}

const role = JSON.parse(body).role;
if (role == "admin") { ... }         // true == "admin" → false (safe)
if (role) { grantAccess(); }         // true → access granted (confused)

// Or numeric confusion:
// App expects: {"age": 18}
// Attacker sends: {"age": "18abc"}
const age = parseInt(data.age);      // parseInt("18abc") → 18 → passes!
```

---

## Python Type Confusion

Python is strongly typed but still has type confusion edge cases.

### Numeric Type Mixing

```python
# int and float compare as equal
1   == 1.0    # True
1   == True   # True  ← bool is subclass of int
0   == False  # True
2   == True   # False ← True is 1, not 2

# Attack: if auth check compares with True
role = get_user_role()   # returns 1 (admin level)
if role == True:         # 1 == True → True → admin access granted
    grant_admin()
```

### String vs Bytes Comparison

```python
# Python 3: str and bytes are never equal
"admin" == b"admin"   # False
"admin" is b"admin"   # False

# But if decoded improperly:
user_input = b"admin\x00extra"
stored     = "admin"
if user_input.decode('utf-8', errors='ignore') == stored:
    # \x00 and beyond ignored → "admin" == "admin" → True
```

### None Comparisons

```python
# None comparisons
None == False    # False
None == 0        # False
None == ""       # False
None is None     # True (use 'is' for None checks)
not None         # True ← None is falsy

# Attack: if check uses truthiness instead of explicit type check
token = get_token()          # returns None (no token)
if not token:                # not None → True → "no token" branch... or:
if token == expected:        # None == expected → False (safe)
# But:
if token:                    # None is falsy → doesn't grant access (safe)
# Danger is when None causes unexpected behavior in comparison logic
```

### assert Statements in Production

```python
# ❌ Dangerous — assert is disabled with python -O (optimize flag)
def check_admin(user):
    assert user.role == "admin", "Not admin"
    return True

# With: python -O app.py → assert statements are stripped → check_admin always returns True
```

---

## Ruby Type Confusion

### Regex Anchors

```ruby
# ❌ Vulnerable — ^ and $ match start/end of LINE, not string
# Attacker input: "safe_value\nmalicious_input"
if user_input =~ /^\d+$/
  puts "Valid number"
end

# Input: "123\nmalicious" → ^ matches start of first line "123" → passes!

# ✅ Fixed — use \A and \z for string anchors
if user_input =~ /\A\d+\z/
  puts "Valid number"
end
```

### String to Integer Coercion

```ruby
"10abc".to_i   # 10  ← stops at first non-digit
"abc".to_i     # 0   ← returns 0 for non-numeric
"0x10".to_i    # 0   ← doesn't parse hex (use to_i(16))
Integer("10abc") # ArgumentError ← strict, raises on invalid
```

---

## Type Confusion in JSON APIs

Modern APIs frequently suffer from type confusion when JSON values are not validated strictly.

### Boolean String Bypass

```http
-- App checks: if (data.admin === true)
-- Attacker sends string "true" instead of boolean true

POST /api/update-role HTTP/1.1
Content-Type: application/json

{"admin": "true"}    ← string, not boolean

-- If backend does: if (data.admin == true) → "true" == true → coercion → true
-- If backend does: if (data.admin)         → "true" is truthy → true
```

### Numeric String Bypass

```http
-- App expects numeric ID, checks against whitelist of ints
-- Attacker sends string "1" or "01" or "1.0"

{"user_id": "1"}     ← string
{"user_id": 1.0}     ← float
{"user_id": 1e0}     ← scientific notation
{"user_id": [1]}     ← array containing 1

-- PHP: "1" == 1 → true
-- JS: "1" == 1 → true
-- Python: "1" == 1 → False (safe), but int("1") == 1 → True
```

### Array Injection

```http
-- App expects single string value
-- Attacker sends array

{"username": ["admin"]}   ← array instead of string
{"username": {"$gt": ""}} ← object (NoSQL injection)

-- PHP: strcmp(["admin"], "admin") → null → null == 0 → bypass
-- JS: ["admin"] == "admin" → "admin" == "admin" → true (array coerces to string)
```

---

## Exploitation Workflow

1. **Identify comparison points** — find login checks, role checks, token validation, any `==` in auth logic
2. **Determine the language** — PHP, JS, Python, Ruby each have different coercion rules
3. **Check PHP version** — PHP 7 vs PHP 8 differ significantly on `0 == "string"`
4. **Test magic hashes** — if MD5/SHA1 hash comparison uses `==`, try known `0e...` inputs
5. **Test array bypass** — send `param[]` or `param[0]` instead of a string value
6. **Test strcmp null** — send array to strcmp-based checks
7. **Test boolean coercion** — send `true`, `1`, `"1"`, `"true"` for boolean checks
8. **Test JSON type swap** — change `true` → `"true"`, `1` → `"1"`, string → array
9. **Verify the bypass** — confirm access granted / logic skipped with the confused value

---

## Common Vulnerable Patterns

**PHP loose hash comparison:**

```php
// ❌ Vulnerable
if (md5($password) == $stored_hash) { grant(); }

// ✅ Fixed
if (hash_equals($stored_hash, md5($password))) { grant(); }
// OR
if (md5($password) === $stored_hash) { grant(); }
```

**PHP strcmp array bypass:**

```php
// ❌ Vulnerable
if (strcmp($_POST['token'], $secret) == 0) { grant(); }

// ✅ Fixed
if (strcmp($_POST['token'], $secret) === 0) { grant(); }
// AND validate $_POST['token'] is a string first
if (!is_string($_POST['token'])) { die("Invalid"); }
```

**JavaScript loose admin check:**

```javascript
// ❌ Vulnerable
if (user.role == "admin") { grantAdmin(); }

// ✅ Fixed
if (user.role === "admin") { grantAdmin(); }
```

**JSON boolean string confusion (Node.js):**

```javascript
// ❌ Vulnerable
const isAdmin = req.body.admin;
if (isAdmin == true) { grant(); }     // "true" == true → coerces → true

// ✅ Fixed
const isAdmin = req.body.admin;
if (isAdmin === true) { grant(); }    // "true" === true → false
```

**Python assert in production:**

```python
# ❌ Vulnerable
def require_admin(user):
    assert user['role'] == 'admin'   # stripped with -O flag

# ✅ Fixed
def require_admin(user):
    if user['role'] != 'admin':
        raise PermissionError("Admin required")
```

---

## CTF & Practical Tips

**Fastest initial checks:**

```
-- PHP: try these as password/token inputs:
0               ← 0 == "anything" (PHP 7)
true            ← true == "anything"
[]              ← array bypass for strcmp/in_array
QNKCDZO         ← md5 starts with 0e (magic hash)
240610708       ← md5 starts with 0e (magic hash)
aaroZmOk        ← sha1 starts with 0e (magic hash)

-- JS: try in JSON body:
{"admin": true}      vs   {"admin": "true"}
{"id": 0}            vs   {"id": false}
{"token": null}      vs   {"token": "null"}

-- API: try array instead of string:
username=admin[]     ← PHP array
{"username": ["admin"]}  ← JSON array
```

**Speed tips:**
- ✅ Always try `param[]=value` in PHP apps — converts to array, breaks strcmp/in_array
- ✅ Check PHP version — PHP 7 `0 == "string"` is `true`; PHP 8 fixed it
- ✅ Magic hashes: if MD5 comparison uses `==`, try `QNKCDZO` as password first
- ✅ In JS APIs, swap boolean `true` for string `"true"` in JSON — many backends don't type-check
- ✅ `hash_equals()` in PHP is immune to type confusion AND timing attacks — its presence means the check is hardened
- ⚠️ Python is strongly typed — type confusion is less common but `True == 1` still bites numeric role checks
- ⚠️ Ruby regex `^$` vs `\A\z` — always test with `\n` in the input if regex validation is suspected

**Common CTF scenarios:**
- **PHP login with `==`** → try `QNKCDZO` (magic hash) or `0` as password
- **"Token validation" in PHP** → send `token[]=x` to break strcmp
- **JS admin panel with JSON API** → swap `{"admin": false}` to `{"admin": "false"}` or `{"admin": 1}`
- **Role check in PHP** → send `role=true` or `role=1` if in_array without strict mode
- **Python auth with numeric role** → role `1` might equal `True` in comparison

---

## Key Takeaways

- ✅ PHP `==` is the most dangerous operator in web security — always look for it in auth logic
- ✅ Magic hashes (`0e...`) bypass MD5/SHA1 loose comparison — `QNKCDZO` is the most famous
- ✅ Sending an array (`param[]`) to strcmp/in_array bypasses string comparison in PHP entirely
- ✅ JavaScript `==` coerces types through a complex chain — `[] == false`, `"" == 0`, `null == undefined` are all `true`
- ✅ JSON type swaps (`true` → `"true"`, `1` → `"1"`, string → array) bypass weakly typed backend checks
- ✅ Python's `True == 1` and `False == 0` mean numeric role values can accidentally match boolean checks