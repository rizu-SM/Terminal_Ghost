# CSRF (Cross-Site Request Forgery)

## Overview
Cross-Site Request Forgery (CSRF) is a security vulnerability that allows an attacker to make a user perform unwanted actions on a website where they're authenticated. The attacker tricks the user into making requests on their behalf without their knowledge.

## How CSRF Works

1. **User Authentication**: User logs into their bank (bank.com)
2. **Malicious Site**: User visits a malicious website (attacker.com) without logging out
3. **Forged Request**: The malicious site sends a request to the bank on behalf of the user
4. **Unintended Action**: The bank processes the request (transfer, password change, etc.) thinking it came from the user

## CSRF Attack Scenarios

### Example 1: Fund Transfer
```html
<!-- On attacker.com -->
<img src="https://bank.com/transfer?to=attacker&amount=1000" />
```

### Example 2: Form-based Attack
```html
<form action="https://vulnerable-site.com/change-email" method="POST">
    <input type="hidden" name="email" value="attacker@evil.com">
    <input type="submit" value="Click here">
</form>
```

### Example 3: AJAX Request
```javascript
fetch('https://vulnerable-api.com/change-password', {
    method: 'POST',
    body: JSON.stringify({newPassword: 'hacked'}),
    credentials: 'include'
});
```

## Key Characteristics

- **Silent Attack**: User may not know they were exploited
- **Relies on Authentication**: Works because user is already logged in
- **Cross-Origin**: Attack originates from a different domain
- **State-Changing**: Typically targets actions (POST, PUT, DELETE)
- **GET Vulnerability**: GET requests can also be vulnerable

## Vulnerable Patterns

```
❌ No CSRF token
❌ CSRF token not validated
❌ CSRF token in URL (can be exposed in logs)
❌ Weak CSRF token generation
❌ No SameSite cookie attribute
❌ Missing Origin/Referer validation
```

## CSRF Token Implementation

### Server-side (Generate Token)
```python
import secrets

def generate_csrf_token():
    return secrets.token_hex(32)

# Store in session
session['csrf_token'] = generate_csrf_token()
```

### HTML Form (Include Token)
```html
<form method="POST" action="/transfer">
    <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
    <input type="text" name="amount" placeholder="Amount">
    <button type="submit">Transfer</button>
</form>
```

### Server-side (Validate Token)
```python
@app.route('/transfer', methods=['POST'])
def transfer():
    token = request.form.get('csrf_token')
    if token != session.get('csrf_token'):
        return "CSRF token invalid", 403
    
    # Process transfer
    return "Transfer successful"
```

## Prevention Techniques

### 1. **CSRF Tokens**
- Generate unique token per request or session
- Include in hidden form field or custom header
- Validate on every state-changing request

### 2. **SameSite Cookie Attribute**
```
Set-Cookie: session=xyz123; SameSite=Strict
```
- **Strict**: Cookie never sent in cross-site requests
- **Lax**: Cookie sent only for top-level navigation
- **None**: Cookie always sent (requires Secure)

### 3. **Double Submit Cookies**
- Generate random token and store in cookie
- Also include in form/header
- Verify both match on server

### 4. **Origin/Referer Header Validation**
```python
def validate_origin(request):
    origin = request.headers.get('Origin')
    referer = request.headers.get('Referer')
    allowed_origins = ['https://trusted-site.com']
    
    if origin and origin not in allowed_origins:
        return False
    return True
```

### 5. **Custom Headers**
- Require specific headers for requests (X-Requested-With)
- Cannot be set by cross-origin requests

### 6. **User Interaction**
- Re-authentication for sensitive operations
- OTP verification
- Confirmation dialogs

## Testing for CSRF

### Manual Testing
1. Intercept request in proxy (Burp Suite)
2. Remove/modify CSRF token
3. Resend request from different origin
4. Check if request is processed

### Automated Testing
```bash
# Check for CSRF token in forms
grep -r "csrf_token\|_token\|authenticity_token" .

# Check for SameSite cookies
grep -r "SameSite" .
```

## Common CSRF Bypasses

### 1. Token Not Validated
- Always validate token on server

### 2. Token in URL
- Tokens can be logged or exposed in Referer headers
- Use POST body or custom headers instead

### 3. Weak Token Generation
- Use cryptographically secure random generation
- Make tokens unpredictable

### 4. SameSite Bypass
- Old browsers may not support SameSite
- Combine with other defenses

### 5. Origin Header Removal
- Validate Referer even if Origin is absent
- Implement multiple layers of defense

## Real-World Vulnerabilities

- **Twitter**: CSRF token not properly validated (2008)
- **YouTube**: Subscription via CSRF (2010)
- **Banking Systems**: Fund transfers via CSRF attacks
- **Social Media**: Profile modification via CSRF

## Tools & Resources

- **Burp Suite**: CSRF token analysis and testing
- **OWASP ZAP**: Automated CSRF detection
- **PortSwigger**: CSRF labs and tutorials
