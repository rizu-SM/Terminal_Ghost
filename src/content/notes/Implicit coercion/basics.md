# Implicit Coercion — Basics

---

## Quick Reference

| Language | Expression | Result | Why |
|----------|-----------|--------|-----|
| JavaScript | `0 == false` | `true` | false → 0, 0 == 0 |
| JavaScript | `"" == false` | `true` | both → 0 |
| JavaScript | `[] == false` | `true` | [] → "" → 0 |
| JavaScript | `"5" + 3` | `"53"` | + prefers string concat |
| JavaScript | `"5" - 3` | `2` | - forces number |
| JavaScript | `null == undefined` | `true` | spec rule |
| JavaScript | `NaN == NaN` | `false` | NaN is never equal |
| PHP | `0 == "admin"` | `true` (PHP7) | string → int 0 |
| PHP | `"0e1" == "0e2"` | `true` | both → 0.0 |
| PHP | `true == "any"` | `true` | "any" → true |
| Python | `0 == False` | `True` | bool is int subclass |
| Python | `1 == True` | `True` | True is 1 |

```javascript
// The 3 coercion operators to remember:
+value    // ToNumber:  +"3" → 3,  +[] → 0,  +{} → NaN,  +null → 0
`${value}` // ToString: `${[]}` → "",  `${{}}` → "[object Object]"
!!value   // ToBoolean: !!0 → false, !!"" → false, !![] → true, !!{} → true
```

---

## What is Implicit Coercion? 🔓

Implicit coercion happens when a language **automatically converts a value from one type to another** without you asking it to. Unlike explicit conversion (`parseInt()`, `(int)$var`, `str(x)`), implicit coercion fires silently — triggered by operators, comparisons, or function calls that expect a different type than what they received.

**Impact:**
- 🔴 Auth bypass — comparisons evaluate `true` with wrong-type inputs
- 🔴 Logic bypass — numeric checks pass with string or array inputs
- 🔴 Validation bypass — length checks, range checks, type guards all broken
- 🔴 Unexpected behavior — coercion produces values the developer never anticipated
- ⚠️ The attacker's goal is to supply a value whose **coerced form** passes a check that its **literal form** would fail

**The core idea:**

```javascript
// Developer writes a check expecting a number:
if (userInput > 0 && userInput < 100) {
    processValue(userInput);
}

// Attacker sends: "50abc"
// JavaScript: "50abc" > 0  → NaN > 0  → false  ← blocked? No...
// Actually:   "50abc" - 0  → NaN
// But:        "50" > 0     → 50 > 0   → true   ← passes if input is "50"
// The type of the input determines which coercion path fires
```

---

## JavaScript — The Coercion Engine

JavaScript has the most complex implicit coercion system of any mainstream language. Every comparison and operator runs through abstract algorithms defined in the ECMAScript spec.

### The Three Core Algorithms

**ToBoolean — what becomes false:**

```javascript
// Only these 8 values are falsy in JavaScript:
false
0
-0
0n          // BigInt zero
""          // empty string
null
undefined
NaN

// EVERYTHING else is truthy — including:
"0"         // truthy ← non-empty string
"false"     // truthy ← non-empty string
[]          // truthy ← empty array
{}          // truthy ← empty object
-1          // truthy ← non-zero number
Infinity    // truthy
```

**ToNumber — how values become numbers:**

```javascript
// Primitives
Number(undefined)   // NaN
Number(null)        // 0
Number(true)        // 1
Number(false)       // 0
Number("")          // 0     ← empty string is 0!
Number(" ")         // 0     ← whitespace string is 0!
Number("3")         // 3
Number("3.14")      // 3.14
Number("3abc")      // NaN   ← non-numeric string
Number("0x10")      // 16    ← hex parsed
Number("0b10")      // 2     ← binary parsed
Number("0o10")      // 8     ← octal parsed
Number("1e2")       // 100   ← scientific notation
Number(" 3 ")       // 3     ← whitespace trimmed first

// Objects — calls ToPrimitive first
Number([])          // 0     ← [] → "" → 0
Number([3])         // 3     ← [3] → "3" → 3
Number([1,2])       // NaN   ← [1,2] → "1,2" → NaN
Number({})          // NaN   ← {} → "[object Object]" → NaN
```

**ToString — how values become strings:**

```javascript
String(undefined)   // "undefined"
String(null)        // "null"
String(true)        // "true"
String(false)       // "false"
String(0)           // "0"
String(-0)          // "0"    ← -0 becomes "0"!
String(NaN)         // "NaN"
String(Infinity)    // "Infinity"
String([])          // ""     ← empty array is empty string
String([1,2,3])     // "1,2,3"
String([[1],[2]])   // "1,2"  ← nested arrays flatten
String({})          // "[object Object]"
String(null)        // "null"
```

### ToPrimitive — Objects Before Comparison

Before an object can be compared numerically or as a string, JavaScript calls `ToPrimitive` which tries `valueOf()` then `toString()`:

```javascript
// Array ToPrimitive:
[].valueOf()        // [] (not primitive) → try toString()
[].toString()       // ""  ← empty string
[1].toString()      // "1"
[1,2].toString()    // "1,2"

// Object ToPrimitive:
({}).valueOf()       // {} (not primitive) → try toString()
({}).toString()      // "[object Object]"

// Custom valueOf:
const obj = { valueOf() { return 42; } };
obj + 1             // 43  ← valueOf() called
obj == 42           // true
```

### The `+` Operator — Addition vs Concatenation

`+` checks if either operand is a string — if yes, it concatenates. This makes `+` the most surprising coercion operator:

```javascript
// Number + Number → addition
1 + 2               // 3

// String + anything → concatenation
"1" + 2             // "12"
1 + "2"             // "12"
"" + 1              // "1"
"" + null           // "null"
"" + undefined      // "undefined"
"" + true           // "true"
"" + []             // ""
"" + {}             // "[object Object]"

// The trap — order matters:
1 + 2 + "3"         // "33"  ← (1+2)=3, then 3+"3"="33"
"1" + 2 + 3         // "123" ← "1"+2="12", then "12"+3="123"

// Subtraction always converts to number:
"5" - 3             // 2    ← "5" → 5
"5" - "3"           // 2    ← both → numbers
[] - 1              // -1   ← [] → 0, 0-1=-1
{} - 1              // -1   (in expression context)
```

### Abstract Equality `==` — The Full Algorithm

When `x == y` is evaluated and the types differ:

```
1. If same type → use strict comparison
2. null == undefined → true (only these two equal each other this way)
3. number == string → convert string to number, retry
4. x == boolean → convert boolean to number, retry
5. x == object → call ToPrimitive on object, retry
```

Tracing complex cases:

```javascript
// [] == false
// Step 4: false → 0,  [] == 0
// Step 5: [] → ToPrimitive → "" , "" == 0
// Step 3: "" → 0,  0 == 0  → TRUE

// [] == ![]
// Right side: ![] → ToBoolean([]) = true → !true = false
// [] == false
// → true (same as above)

// null == 0
// null only equals undefined in ==, nothing else
// → FALSE

// "" == 0
// Step 3: "" → Number("") = 0,  0 == 0  → TRUE

// "0" == false
// Step 4: false → 0,  "0" == 0
// Step 3: "0" → 0,  0 == 0  → TRUE

// "0" == true
// Step 4: true → 1,  "0" == 1
// Step 3: "0" → 0,  0 == 1  → FALSE ← surprising!
```

### Comparison Operators `>` `<` `>=` `<=`

These always convert operands to numbers (unless both are strings):

```javascript
"10" > 9            // true  ← "10" → 10
"10" > "9"          // false ← string compare, "1" < "9"
null > 0            // false ← null → 0, 0 > 0 = false
null == 0           // false ← null only equals undefined
null >= 0           // true  ← null → 0, 0 >= 0 = true ← TRAP
// null is simultaneously not > 0, not < 0, not == 0, but >= 0!

undefined > 0       // false ← undefined → NaN
undefined < 0       // false ← NaN comparisons always false
undefined == 0      // false
NaN > 0             // false
NaN < 0             // false
NaN == NaN          // false ← NaN is never equal to anything
```

---

## JavaScript — Falsy Value Attacks

### The `if (value)` Trap

```javascript
// Developer intends: "if user is logged in"
if (user.token) {
    grantAccess();
}

// Attacker supplies token = 0, "", false, null, undefined
// All are falsy → grantAccess() never called

// But also:
// token = "false"   → truthy (non-empty string) → grantAccess() called
// token = "0"       → truthy → grantAccess() called
// token = "null"    → truthy → grantAccess() called
// token = []        → truthy → grantAccess() called
// token = {}        → truthy → grantAccess() called
```

### Array and Object Truthiness

```javascript
// These all pass if (x) checks:
if ([])   { } // runs  ← empty array is truthy!
if ({})   { } // runs  ← empty object is truthy!
if ("0")  { } // runs  ← "0" is truthy!
if ("false") {} // runs ← "false" is truthy!

// Developer expects array to be falsy when empty (like Python):
const items = [];
if (items) {
    processItems(items);   // ← RUNS with empty array, probably not intended
}
// Fix: if (items.length > 0)
```

### The `-0` Trap

```javascript
-0 === 0        // true  ← strict equality ignores sign
-0 == 0         // true
String(-0)      // "0"   ← -0 becomes "0" in string context
JSON.stringify(-0) // "0" ← serialized as 0
1 / -0          // -Infinity
1 / 0           //  Infinity
Object.is(-0, 0)  // false ← only way to distinguish
```

---

## PHP — Silent Type Conversion

PHP's type juggling is documented in the previous file (type-confusion-basics.md) but coercion deserves its own treatment here.

### Arithmetic Coercion

```php
// String → number in arithmetic
"3" + 4         // 7    ← "3" → 3
"3.5" + 1       // 4.5
"3abc" + 1      // 4    ← stops at first non-numeric
"abc" + 1       // 1    ← "abc" → 0, 0+1=1
true + true     // 2    ← true → 1
false + 1       // 1    ← false → 0
null + 1        // 1    ← null → 0
[] + 1          // "1"  ← [] → "" → concatenation
```

### String Context Coercion

```php
// Values coerced to strings:
(string)null        // ""
(string)false       // ""
(string)true        // "1"
(string)0           // "0"
(string)[]          // "Array"  + Notice
(string)1.0         // "1"

// Implicit in echo/print:
echo null;          // (nothing)
echo false;         // (nothing)
echo true;          // "1"
echo [];            // "Array"
```

### Boolean Coercion — What's Falsy in PHP

```php
// Only these are false in PHP:
false
0
0.0
"0"          // ← the string "0" is false! (unlike JavaScript where "0" is truthy)
""           // empty string
[]           // empty array
null

// Everything else is truthy — including:
"false"      // true  ← non-zero-ish string
"0.0"        // true  ← not exactly "0"
" "          // true  ← space is truthy
[0]          // true  ← non-empty array
```

⚠️ PHP and JavaScript differ on `"0"` — it's **falsy in PHP** but **truthy in JavaScript**. Critical difference when porting logic between languages.

### Type Coercion in Function Arguments

```php
// Functions that coerce arguments:
intval("42abc")         // 42   ← stops at non-digit
intval("0x1A", 16)      // 26   ← hex parsing
settype($var, "integer") // coerces in place
(int)"3.9"              // 3    ← truncates
(bool)""                // false
(bool)"0"               // false ← "0" → false
(bool)"false"           // true  ← non-"0" string → true
(array)"hello"          // ["hello"]
(object)["a"=>"b"]      // stdClass with property a="b"
```

---

## Python — Coercion and Falsy Values

Python is strongly typed — fewer implicit coercions than PHP or JavaScript — but still has important coercion behaviors.

### Falsy Values in Python

```python
# These are all falsy (evaluate to False in boolean context):
False
0
0.0
0j          # complex zero
""          # empty string
b""         # empty bytes
[]          # empty list
()          # empty tuple
{}          # empty dict
set()       # empty set
None

# Truthy — everything else, including:
"0"         # truthy ← non-empty string (unlike PHP!)
"False"     # truthy
[0]         # truthy ← non-empty list
{0}         # truthy ← non-empty set
0.1         # truthy
```

### bool is a Subclass of int

```python
# In Python, bool inherits from int
isinstance(True, int)   # True
isinstance(False, int)  # True

True  == 1    # True
False == 0    # True
True  + True  # 2
True  * 5     # 5
False + 1     # 1

# Dangerous in comparisons:
role = 1       # admin level
if role == True:
    grant_admin()   # 1 == True → True → admin granted!

# In dicts:
d = {True: "yes", 1: "no"}
# True and 1 are the same key!
print(d)        # {True: "no"}  ← 1 overwrote True's value
```

### Arithmetic String Coercion (Python Does NOT Do This)

```python
# Python DOES NOT implicitly coerce strings to numbers:
"3" + 4     # TypeError: can only concatenate str (not "int") to str
"3" * 4     # "3333"  ← str * int = repetition (not multiplication)
"3" > 4     # TypeError in Python 3 (allowed in Python 2!)
```

### Comparison Edge Cases

```python
# None comparisons
None == False   # False
None == 0       # False
None == ""      # False
None is None    # True  ← use 'is' for None checks
not None        # True  ← None is falsy

# NaN in Python (from float)
float('nan') == float('nan')  # False ← same as JS
import math
math.isnan(float('nan'))      # True  ← correct check

# Integer overflow — Python has arbitrary precision
2**1000 == 2**1000    # True  ← no overflow
```

---

## Ruby — Coercion Behaviors

```ruby
# Falsy values — ONLY false and nil
# Everything else is truthy, including 0!
if 0    then "truthy" end   # "truthy" ← 0 is truthy in Ruby!
if ""   then "truthy" end   # "truthy" ← empty string is truthy!
if []   then "truthy" end   # "truthy" ← empty array is truthy!

# String to integer
"3".to_i        # 3
"3abc".to_i     # 3    ← stops at first non-digit
"abc".to_i      # 0    ← non-numeric → 0
Integer("3")    # 3    ← strict
Integer("3abc") # ArgumentError ← strict raises on invalid

# Comparison coercion
1 == 1.0        # true  ← int/float comparison
1.eql?(1.0)     # false ← strict type + value
1.equal?(1)     # true  ← object identity (small ints cached)
```

---

## Coercion Comparison Tables

### JavaScript `==` Full Table (Selected)

| Left | Right | Result | Path |
|------|-------|--------|------|
| `null` | `undefined` | `true` | spec rule |
| `null` | `false` | `false` | null ≠ false |
| `null` | `0` | `false` | null ≠ 0 |
| `undefined` | `false` | `false` | undefined ≠ false |
| `0` | `false` | `true` | false→0, 0==0 |
| `""` | `false` | `true` | false→0, ""→0, 0==0 |
| `"0"` | `false` | `true` | false→0, "0"→0, 0==0 |
| `"0"` | `true` | `false` | true→1, "0"→0, 0≠1 |
| `[]` | `false` | `true` | false→0, []→""→0, 0==0 |
| `[]` | `0` | `true` | []→""→0, 0==0 |
| `[]` | `""` | `true` | []→"", ""=="" |
| `[0]` | `false` | `true` | [0]→"0"→0, false→0 |
| `[0]` | `0` | `true` | [0]→"0"→0 |
| `[[]]` | `0` | `true` | [[]]→""→0 |
| `{}` | `false` | `false` | {}→"[object Object]"→NaN, NaN≠0 |
| `NaN` | `NaN` | `false` | NaN never equals anything |

### PHP `==` Selected Cases

| Left | Right | Result | Notes |
|------|-------|--------|-------|
| `0` | `"admin"` | `true` (PHP7) / `false` (PHP8) | string→int 0 |
| `0` | `""` | `true` (PHP7) / `false` (PHP8) | |
| `0` | `"0"` | `true` | "0"→0 |
| `0` | `null` | `true` | null→0 |
| `0` | `false` | `true` | false→0 |
| `1` | `true` | `true` | true→1 |
| `100` | `"1e2"` | `true` | "1e2"→100.0 |
| `"1"` | `"01"` | `true` | both→int 1 |
| `"0e1"` | `"0e9"` | `true` | both→0.0 |
| `true` | `"anything"` | `true` | "anything"→true |
| `null` | `""` | `true` | |
| `null` | `false` | `true` | |
| `[]` | `false` | `true` | |
| `[]` | `null` | `true` | |

### Python Falsy Comparison

| Value | `bool(x)` | `x == False` | `x == 0` | Notes |
|-------|-----------|-------------|---------|-------|
| `False` | `False` | `True` | `True` | |
| `0` | `False` | `True` | `True` | bool is int |
| `0.0` | `False` | `True` | `True` | |
| `""` | `False` | `False` | `False` | empty str falsy but ≠ False |
| `[]` | `False` | `False` | `False` | empty list falsy but ≠ False |
| `None` | `False` | `False` | `False` | only equals None |
| `True` | `True` | `False` | `False` | True == 1 |
| `1` | `True` | `False` | `False` | 1 == True |
| `"0"` | `True` | `False` | `False` | truthy in Python! |

---

## Exploitation Workflow

1. **Identify the language** — JS, PHP, Python, Ruby each have different coercion rules
2. **Find the comparison** — locate `==`, `if (x)`, arithmetic, or function argument coercion
3. **Determine expected type** — what does the developer think they're comparing?
4. **Apply coercion rules** — what does your input coerce to? Does it match?
5. **Test ToBoolean** — if it's a truthiness check, can you send a truthy value that shouldn't be truthy?
6. **Test ToNumber** — if it's numeric, can you send a value that coerces to the right number?
7. **Test comparison operators** — does `>=` behave differently than `==` and `>`?
8. **Test array/object** — does sending `param[]=x` or `{"param": [x]}` confuse the check?
9. **Verify bypass** — confirm the coerced value passes the check in isolation before submitting

---

## Common Vulnerable Patterns

**JavaScript truthiness auth check:**

```javascript
// ❌ Vulnerable — truthy check on token
const token = req.headers['x-token'];
if (token) {
    // "false", "0", "null", [] all pass this check
    grantAccess();
}

// ✅ Fixed — explicit type and value check
if (typeof token === 'string' && token === expectedToken) {
    grantAccess();
}
```

**PHP loose comparison in login:**

```php
// ❌ Vulnerable — == allows type coercion
if ($submitted_password == $stored_password) {
    login();
}
// Input: "0e123" matches any hash starting with "0e"

// ✅ Fixed — === or hash_equals
if (hash_equals($stored_password, $submitted_password)) {
    login();
}
```

**Python numeric role confusion:**

```python
# ❌ Vulnerable — 1 == True in Python
def is_admin(role_level):
    return role_level == True   # role_level=1 → 1==True → True!

# ✅ Fixed — explicit type and value
def is_admin(role_level):
    return isinstance(role_level, int) and role_level == 1 and not isinstance(role_level, bool)
```

**JavaScript `+` operator confusion:**

```javascript
// ❌ Vulnerable — + on user input does string concat, not addition
const total = req.body.price + req.body.tax;
// price="100", tax="10" → "100" + "10" = "10010" not 110

// ✅ Fixed — explicit numeric conversion
const total = Number(req.body.price) + Number(req.body.tax);
// Or: parseFloat(req.body.price) + parseFloat(req.body.tax)
```

---

## CTF & Practical Tips

**Fastest initial checks per language:**

```javascript
// JavaScript — test these in any comparison:
""          // ToNumber → 0
" "         // ToNumber → 0 (whitespace)
[]          // ToNumber → 0
"0"         // falsy in PHP, truthy in JS — cross-language confusion
true        // ToNumber → 1
false       // ToNumber → 0
null        // ToNumber → 0
undefined   // ToNumber → NaN
NaN         // never equals anything
```

```php
// PHP — test these:
0           // == any non-numeric string (PHP7)
"0e123"     // == any other "0e..." string
true        // == any truthy value
[]          // breaks strcmp, in_array
null        // == false, == 0, == ""
```

```python
# Python — test these:
True        # == 1
False       # == 0
1           # == True (role bypass)
```

**Speed tips:**
- ✅ JavaScript `[] == false` and `[] == 0` are both true — arrays are the most surprising coercion source
- ✅ PHP `"0"` is **falsy** — this breaks logic ported from JavaScript where `"0"` is truthy
- ✅ Python `"0"` is **truthy** — opposite of PHP, same trap in reverse
- ✅ JavaScript `null >= 0` is `true` but `null == 0` is `false` — null breaks range checks
- ✅ `NaN !== NaN` in both JS and Python — NaN-based validation bypasses are common
- ⚠️ PHP 8 fixed `0 == "string"` — always check PHP version before assuming this works
- ⚠️ Ruby's `0` is **truthy** — completely opposite to every other language here

**Common CTF scenarios:**
- **JS comparison with `==`** → try `[]`, `""`, `false`, `0`, `null` — one of them coerces to match
- **PHP login with `==`** → magic hash (`QNKCDZO`), `0`, `true`, array bypass
- **"Numeric" param in JS API** → send `""`, `[]`, `" "` — all coerce to 0
- **Python role check** → send integer `1` where boolean `True` expected
- **`+` operation on input** → send string to force concatenation instead of addition

---

## Key Takeaways

- ✅ JavaScript's `==` runs through a multi-step algorithm that converts types — always trace it manually for non-obvious cases
- ✅ `ToBoolean`, `ToNumber`, `ToString` are the three conversion algorithms — understanding them predicts every coercion outcome
- ✅ `[]` is truthy but coerces to `0` numerically and `""` as a string — it's the most surprising coercion value in JavaScript
- ✅ PHP's `"0"` is falsy; JavaScript's `"0"` is truthy — this single difference causes bugs wherever logic is ported between the two
- ✅ Python's `True == 1` and `False == 0` mean numeric role values silently match boolean checks
- ✅ `null >= 0` is `true` in JavaScript but `null == 0` is `false` — null breaks range validation in a non-obvious way