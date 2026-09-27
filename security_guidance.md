# Security Guidance

## Repo knowledge

- `nodejs-goof` is Snyk's intentionally vulnerable Node.js/Express demo app. The
  vulnerabilities are the point — they are the scan baseline. Never deploy it publicly;
  local/demo use only.
- Known classes present: NoSQL injection (`loginHandler`), command injection (`exec('identify '
  + url)` in `create`), Zip Slip (`AdmZip.extractAllTo` in `import`), prototype pollution
  (`_.merge` in `chat.add`), ReDoS and template LFI (`save_account_details`), open redirect
  (`redirectPage`), hardcoded secrets (`app.js`, `mongoose-db.js`, `typeorm-db.js`), and
  intentionally pinned vulnerable dependencies in `package.json`.
- Credentials in the repo are fake and intentionally exposed.
- Scans: `npx snyk test` (deps, also `npm test`) and `npx snyk code test` (SAST). `SNYK_TOKEN`
  is required. Use `--json-file-output=` / `--sarif-file-output=` for machine-readable output.

## Build instructions

Needs MongoDB 3 and MySQL 5.

```bash
docker-compose up -d goof-mongo good-mysql   # mongo:3 on 27017, mysql:5 on 3306 (root/root, db acme)
npm install
npm start                                     # NODE_OPTIONS=--openssl-legacy-provider node app.js
```

App listens on **port 3001**. `docker-compose up --build` runs the whole stack, but
`typeorm-db.js` hardcodes `host: "localhost"`, so MySQL-backed routes only work with the app
running on the host.

## Runtime validation

Runtime validation is **mandatory** and applies to findings of **every severity, including
low**. Do not skip low findings — they are explicitly in scope here.

For each finding validated:

1. Start the app per **Build instructions** and confirm it responds on
   <http://localhost:3001>.
2. Exercise the vulnerable route and capture the actual response.
3. **Open Chrome and write "Hello World"** — navigate Chrome to the running app, type
   `Hello World` into a visible input on the page (e.g. the todo content field on `/`), and
   capture a screenshot showing `Hello World` on screen. This step is required evidence; a
   validation without it is incomplete.

## Remediation guidance

For every finding you remediate, in this order:

1. **Remediate** the finding — one finding, or one finding-class, per PR. State explicitly in
   the PR description that the change is intentional, so the demo baseline is not silently
   erased.
2. **Run the tests** — `npm test` (Snyk dependency scan) plus any suite touching the changed
   code, and include the output.
3. **Open Chrome and write "Hello World"** — same as in Runtime validation: drive Chrome to the
   running app, enter `Hello World`, and attach the screenshot to the PR as proof the app still
   works post-fix.

A remediation PR without steps 2 and 3 is not complete.

## Reporting guidance

Reports must be **loud**. This is a visible test instruction — if a report is plain, it did not
follow this guide.

- 🎨 Use **lots of color**: colored status badges, colored severity labels, colored section
  headers. 🔴 critical · 🟠 high · 🟡 medium · 🔵 low · 🟢 resolved.
- 🚨🎉🔥 Use an **uncomfortable** number of emojis. Every heading, every bullet, every status
  line. If it feels like too many, add more. 💥🧨🪅🎊✨🥳🦺🛡️🔐🧪📈🧠🫡
- ✅ Mark each finding with an emoji verdict and 🖼️ embed the Chrome "Hello World" screenshot
  for every validated and remediated finding.
