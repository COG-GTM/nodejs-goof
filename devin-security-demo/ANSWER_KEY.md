# Answer key (presenter only)

What was planted in `app/`. Use it to check the scan, not as a slide.

| # | Issue | Where | Severity (expected) |
|---|---|---|---|
| 1 | **Chain:** any logged-in user reads another user's share token, then the public export endpoint runs a shell command built from `format` | `routes/notes.js` `/:id/meta` (no owner check) + `routes/share.js` `/:token/export` (`execSync` with query string) | Critical as a chain |
| 2 | Path traversal: `name` is joined to the uploads dir unchecked (`?name=../config.js`) | `routes/files.js` | High |
| 3 | Any member can delete any user (no admin check) | `routes/users.js` `DELETE /:id` | High |
| 4 | Prototype pollution: `_.merge` of request body with lodash 4.17.15 (CVE-2020-8203) | `routes/users.js` `PATCH /me/prefs`, `package.json` | Medium/High |
| 5 | Hardcoded session signing secret; plaintext passwords; non-constant-time MAC compare | `config.js`, `db.js`, `auth.js` | Medium |

The chain is the story: each half looks minor alone (an info leak, and an endpoint that "needs a secret link"),
together they give remote code execution to any user. Verified locally:

```bash
# as mallory: leak alice's share token, then run `id` on the server
curl -s localhost:3000/api/notes/1/meta -H "authorization: Bearer $MALLORY"      # -> shareToken
curl -s "localhost:3000/share/$TOKEN/export?format=txt;id"                      # -> uid=...
```
