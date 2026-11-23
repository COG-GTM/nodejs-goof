# Devin Security demo script (~12 minutes)

**Story in one line:** scanners give you a list of alerts; Devin Security reads your code like an attacker, proves what is real, ranks it against your threat model, and hands you a fix as a pull request a human approves.

**App:** Acme Notes, a small notes API (`devin-security-demo/app`). Users write notes and share them with a secret link.

## Before you present (15 min, day before)

1. Run one scan ahead of time: Devin → **Security → Scans → New scan**, repo `COG-GTM/nodejs-goof`, path `devin-security-demo/app`, **Normal** effort. It takes a while; you will show this completed scan live.
2. On that scan, click **Fix with Devin** on the chained "share export" finding so a fix PR already exists.
3. Open these tabs in order: the repo folder, the completed scan, the findings list, the chain finding, the fix session, the fix PR, the Threats page.
4. Check the results against `ANSWER_KEY.md`. The exact titles and counts will differ from run to run; never promise a number.

**What the rehearsal scan found** (Normal effort, 7 findings): 2 critical (command injection in share export; hardcoded signing secret lets anyone forge an admin login), 3 high (share-token leak from the metadata endpoint; path traversal in file download; plaintext seeded passwords), 1 medium (any member can delete any user), 1 low (non-constant-time token compare). It did **not** flag the old lodash `_.merge` (CVE-2020-8203). That gap sets up step 6.

## The demo

### 1. Set the scene (1 min) — tab: repo folder
- "This is Acme Notes. You log in, write notes, and share a note with a secret link."
- "It has the same kinds of bugs real apps have. Let's see what Devin finds, without telling it anything."

### 2. Start a scan (1 min) — Security → New scan
- Show the form: pick the repo, narrow to one folder, choose **Normal** or **Deep**.
- "Normal is the default for most repos and for recurring scans. Deep spends more reasoning and validates each finding one at a time, for your crown-jewel repos."
- Start it or cancel. "Scans take a while, so here's one I ran earlier."

### 3. Threat model (2 min) — completed scan, threat model section
- "Before hunting for bugs, Devin works out what matters: entry points, the data the app handles, the assets, and where trust changes."
- Point at the share link boundary: "Devin noticed that `/share` is public and everything under `/api` needs login. That boundary is where bugs hurt most."
- "In interactive mode, it pauses here so you can correct it, for example 'notes contain board-level financials'."

### 4. Findings (3 min) — findings list, then the chain finding
- "Findings are ranked against that threat model, not just by a generic CVSS score."
- Open the chain finding. "Alone, each half looks minor: one endpoint leaks a share token to any logged-in user, and the export endpoint needs that token. Together, any user can run commands on the server."
- Show the evidence: file paths, line numbers, and the validation steps. "This is the difference from a scanner: it explains why it's real and how it got there."
- Filter by severity or status. "Your team triages here: open, reviewed, or dismissed with a reason."

### 5. Fix with Devin (3 min) — fix session, then PR
- "From any finding, Fix with Devin starts a session that writes the fix, runs the tests, and opens a PR."
- Show the PR diff: the owner check on `/meta` and the export no longer building a shell command.
- "Nothing merges on its own. Branch protection, CODEOWNERS and your reviewers all still apply."

### 6. Threats (1 min) — Threats page
- "A scan reasons about how your app works. When a specific CVE drops, you want a targeted answer: are we affected? Add it as a threat, for example 'lodash prototype pollution, CVE-2020-8203', and click Scan with Devin across the repos you pick."
- (Acme Notes uses lodash 4.17.15 with `_.merge` on request bodies in `routes/users.js`, so this repo is affected.)
- "Auto-triage can do that for every new threat Cognition publishes."

### 7. Close (1 min)
- "Bring in what you already have: Snyk, Wiz, GitHub Advanced Security, Veracode, Jira, Linear. Devin triages and fixes those findings too."
- "Put it on a schedule: scan new commits nightly, so new findings show up with a fix one click away."
- Hand to Q&A.

## If something breaks
- Scan still running or failed: use the completed scan tab; that is why you pre-ran it.
- A finding you expected is missing: say "results vary run to run, here's what it did find" and move on. Don't argue with the tool live.
- Fix PR not ready: walk through the finding's recommendation instead.

## Likely questions
- **Does code leave our environment?** Answer from your security/deployment docs for the customer's setup; don't improvise.
- **How is this different from Snyk/SAST?** Scanners match patterns. Devin reasons about how the app works, chains issues, validates them, and writes the fix. It also ingests your scanner's findings.
- **False positives?** Findings are validated before they are reported; you can dismiss with a reason, and that feedback stays with the finding.
- **Cost/time?** Normal is faster and cheaper; Deep is slower and more thorough. Start with Normal on a few repos.
