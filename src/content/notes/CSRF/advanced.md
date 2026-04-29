# CSRF - Advanced Attacks & Defenses

## Advanced CSRF Attack Vectors

### 1. **JSON CSRF (Exploiting CORS Misconfiguration)**
```javascript
// Attacker site can't read response but request is still sent
fetch('https://api.vulnerable.com/user/profile', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'attacker@evil.com'}),
    credentials: 'include'
});
```

### 2. **WebSocket CSRF**
```javascript
// WebSocket connections can be initiated from cross-origin
let ws = new WebSocket('wss://vulnerable-site.com/ws');
ws.onopen = () => {
    ws.send('MALICIOUS_COMMAND');
};
```

### 3. **Flash + CSRF**
```actionscript
// Legacy: Flash could bypass CSRF protections
var request:URLRequest = new URLRequest("https://bank.com/transfer");
request.method = URLRequestMethod.POST;
request.data = new URLVariables("amount=1000&to=attacker");
navigateToURL(request);
```

### 4. **Multipart Form Data CSRF**
```html
<form action="https://vulnerable.com/upload" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="user_id" value="123">
    <input type="file" name="avatar">
    <input type="submit">
</form>
```

### 5. **Same-Site CSRF via Subdomain**
```
Domain: vulnerable.com
Attacker: evil.vulnerable.com (same parent domain)
Issue: Cookies may be shared across subdomains
```

## Advanced Defense Mechanisms

### 1. **Per-Request CSRF Tokens**
```python
# More secure than per-session tokens
import hashlib
import time

def generate_per_request_token(session_id):
    timestamp = int(time.time())
    nonce = secrets.token_hex(16)
    
    token_data = f"{session_id}{timestamp}{nonce}"
    token = hashlib.sha256(token_data.encode()).hexdigest()
    
    # Store mapping of token -> timestamp for expiration
    store_token(token, timestamp)
    return token
```

### 2. **Encrypted Token (Double-Masked CSRF)**
```python
from cryptography.fernet import Fernet

class CSRFToken:
    def __init__(self, secret_key):
        self.cipher = Fernet(secret_key)
    
    def create_token(self, user_id):
        # Create two random values
        client_mask = secrets.token_bytes(32)
        server_mask = secrets.token_bytes(32)
        
        # XOR them
        masked_token = bytes(a ^ b for a, b in zip(client_mask, server_mask))
        
        # Store server mask in session
        session['csrf_mask'] = server_mask
        
        # Return client mask to user
        return base64.b64encode(client_mask).decode()
    
    def verify_token(self, token, session_mask):
        client_mask = base64.b64decode(token)
        reconstructed = bytes(a ^ b for a, b in zip(client_mask, session_mask))
        return reconstructed == session_mask
```

### 3. **State Machine CSRF Protection**
```python
# Track state transitions to prevent CSRF
class StateValidator:
    def __init__(self):
        self.valid_transitions = {
            'viewing_form': ['submitting_form'],
            'submitting_form': ['processing'],
            'processing': ['completed']
        }
    
    def validate_transition(self, current_state, next_state):
        return next_state in self.valid_transitions.get(current_state, [])
    
    def get_token_for_state(self, state):
        token = self.generate_state_token(state)
        return token
```

### 4. **Nonce-Based CSRF Protection**
```python
# Each action gets a unique nonce
class NonceCSRF:
    def __init__(self):
        self.nonce_store = {}  # {nonce: {expires: time, action: 'transfer'}}
    
    def generate_nonce(self, action, user_id, ttl=300):
        nonce = secrets.token_urlsafe(32)
        self.nonce_store[nonce] = {
            'expires': time.time() + ttl,
            'action': action,
            'user_id': user_id,
            'used': False
        }
        return nonce
    
    def validate_and_consume_nonce(self, nonce, action, user_id):
        if nonce not in self.nonce_store:
            return False
        
        data = self.nonce_store[nonce]
        
        # Check expiration
        if data['expires'] < time.time():
            del self.nonce_store[nonce]
            return False
        
        # Check if already used (prevent replay)
        if data['used']:
            return False
        
        # Verify action and user
        if data['action'] != action or data['user_id'] != user_id:
            return False
        
        # Mark as used
        data['used'] = True
        return True
```

### 5. **Content Security Policy (CSP) for CSRF**
```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  frame-ancestors 'none';
  form-action 'self';
```

### 6. **Mutual TLS (mTLS)**
```python
# Client certificate validation
@app.route('/sensitive', methods=['POST'])
def sensitive():
    cert = request.environ.get('SSL_CLIENT_CERT')
    if not verify_client_certificate(cert):
        return "Unauthorized", 403
    
    # Process request
```

## Detecting CSRF Vulnerabilities

### Code Review Checklist
```
[ ] All state-changing operations use POST/PUT/DELETE
[ ] CSRF tokens present in all forms
[ ] Tokens validated on server-side
[ ] Tokens regenerated after authentication
[ ] SameSite attribute set on session cookies
[ ] Origin/Referer headers validated
[ ] No tokens logged or exposed in URLs
[ ] Tokens have appropriate expiration
[ ] Double-submit cookie pattern implemented
```

### Automated Detection
```bash
# Using OWASP ZAP
zaproxy -cmd \
    -quickurl https://target.com \
    -quickout results.html

# Check for missing CSRF tokens in forms
grep -E '<form[^>]*method="(post|put|delete)"' *.html | grep -v 'csrf\|_token'
```

## CSRF in Different Frameworks

### Express.js (Node.js)
```javascript
const csrf = require('csurf');
const express = require('express');

const csrfProtection = csrf({ cookie: false });

app.post('/transfer', csrfProtection, (req, res) => {
    // Token automatically validated
    console.log('Valid CSRF token');
});
```

### Django
```python
from django.middleware.csrf import csrf_protect

@csrf_protect
def transfer(request):
    if request.method == 'POST':
        # CSRF validation automatic
        pass
```

### Flask
```python
from flask_wtf.csrf import CSRFProtect

csrf = CSRFProtect()
csrf.init_app(app)

@app.route('/transfer', methods=['POST'])
@csrf.protect
def transfer():
    pass
```

### Spring Boot
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig extends WebSecurityConfigurerAdapter {
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.csrf().csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse());
    }
}
```

## Real-World Exploitation Examples

### 1. **Email-Based CSRF Attack**
```html
<!-- In email body -->
<img src="https://victim.com/admin/delete-user?id=123" />
```

### 2. **SVG-Based CSRF**
```xml
<svg onload="fetch('https://victim.com/action', {credentials: 'include'})"></svg>
```

### 3. **CSS CSRF**
```html
<link rel="stylesheet" href="https://victim.com/action?param=value">
```

## Mitigation Strategy Summary

1. **Implement CSRF tokens** for all state-changing operations
2. **Set SameSite cookies** to Strict or Lax
3. **Validate Origin/Referer** headers
4. **Use Content-Security-Policy** headers
5. **Implement per-request tokens** for sensitive operations
6. **Add user interaction requirements** for critical actions
7. **Log and monitor** suspicious patterns
8. **Regular security audits** and penetration testing
