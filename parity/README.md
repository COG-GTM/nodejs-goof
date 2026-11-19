# Parity harness (Node.js -> Java 21)

`parity.py` replays one scripted user journey (39 requests: todos CRUD, markdown
rendering, reminders, CSV import, admin login/logout, account details, about page,
chat API, users API, static assets) and records status, content type, redirect
location and a normalized body per request.

- `baseline/node.json` was captured from the legacy Node.js/Express app
  (`npm start`, MongoDB 3.6, MySQL 5.7) before the migration.
- `after/java.json` is captured from the Spring Boot app; `after/java-diff.json`
  lists every mismatch against the baseline.
- `accepted-mismatches.json` lists the differences that are intentional
  (see the PR description for the reasons).

```bash
# fresh app + empty todos collection, then:
python3 parity/parity.py --base http://localhost:8080 --out parity/after/java.json \
  --compare parity/baseline/node.json --allow parity/accepted-mismatches.json
```
