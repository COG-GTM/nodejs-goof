# Security Guidance for `nodejs-goof`

## What this repo is

`nodejs-goof` ("Goof") is Snyk's **intentionally vulnerable** Node.js/Express todo
application. We keep a fork of it as a fixture for demoing and testing security scan
workflows: Snyk Open Source (dependency scanning) and Snyk Code (SAST).

The vulnerabilities are the product. They are the expected scan baseline.

**Rules of engagement:**

- Never deploy this app to a public network. Local, container, or isolated demo use only.
- Do not "clean up" vulnerable code or bump vulnerable dependencies as drive-by changes.
- Do not treat scan findings here as incidents. A clean scan is a broken fixture.
- Credentials in this repo (`admin@snyk.io` / `SuperSecretPassword`, MySQL `root`/`root`,
  the session secret, the hardcoded token in `app.js`) are fake and intentionally exposed.

## Running the security scans locally

Snyk is already a devDependency (`snyk`). Authentication is required: set a `SNYK_TOKEN`
environment variable (or run `npx snyk auth`) before scanning.

```bash
export SNYK_TOKEN="your-token-here"
npm install
```

### Open-source dependency scan

```bash
npx snyk test           # equivalent to `npm test` — the test script is `snyk test`
npx snyk test --json > snyk-deps.json
npx snyk test --sarif > snyk-deps.sarif
```

### Static analysis (SAST)

```bash
npx snyk code test
npx snyk code test --json > snyk-code.json
npx snyk code test --sarif > snyk-code.sarif
```

`--json` and `--sarif` are mutually exclusive per invocation; use `--json-file-output=<path>`
or `--sarif-file-output=<path>` if you also want human-readable console output. SARIF is the
format consumed by GitHub code scanning. Note that the workflows in this repo do not produce
these files: `.github/workflows/snyk-code-manual.yml` uploads the pre-committed `sarif.json`
at the repo root, and `.github/workflows/codeql-analysis.yml` runs CodeQL, not Snyk. Regenerate
`sarif.json` yourself with `npx snyk code test --sarif-file-output=sarif.json` if a demo needs
fresh results.

## Running the app for scan/demo purposes

The app needs **MongoDB 3** (Mongoose models, `mongoose-db.js`) and **MySQL 5**
(TypeORM connection, `typeorm-db.js`). Newer MongoDB majors are not compatible with the
pinned `mongoose@4.2.4`.

### Locally

```bash
npm install
npm start          # NODE_OPTIONS=--openssl-legacy-provider node app.js
```

The legacy OpenSSL provider is set by the `start` script itself and is required on modern
Node versions. The server listens on **port 3001** (`PORT` env var overrides it):
<http://localhost:3001>.

Other scripts in `package.json`:

| Script | Command |
| --- | --- |
| `npm start` | `NODE_OPTIONS=--openssl-legacy-provider node app.js` |
| `npm run dev` | same, via `nodemon` |
| `npm run build` | `browserify -r jquery > public/js/bundle.js` |
| `npm run cleanup` | `mongo express-todo --eval 'db.todos.remove({});'` |
| `npm test` | `snyk test` |

### Databases via Docker

`docker-compose.yml` defines three services:

- `goof` — the app itself (built from the local `Dockerfile`), publishing `3001:3001` and
  the debug port `9229:9229`, with `DOCKER=1` so it resolves Mongo at `goof-mongo`.
- `goof-mongo` — `mongo:3`, published on `27017`.
- `good-mysql` (container name `goof-mysql`) — `mysql:5` on `3306`, root password `root`,
  database `acme`.

```bash
docker-compose up --build      # full stack
docker-compose down
```

Caveat: `typeorm-db.js` hardcodes `host: "localhost"`, so the containerized `goof` service
cannot reach the MySQL container — user seeding and the `/users` routes fail under
`docker-compose up`. For anything MySQL-backed, run the datastores in Docker and the app on
your host:

```bash
docker-compose up -d goof-mongo good-mysql
npm start
```

## Known vulnerability classes present in this codebase

Confirmed by reading the code; this is the ground truth a scan should broadly reproduce.

### Code-level (Snyk Code / SAST)

- **NoSQL injection** — `exports.loginHandler` in `routes/index.js` passes `req.body.password`
  straight into `User.find({...})`, so `{"password": {"$gt": ""}}` with a known username
  authenticates without a password. The username itself is guarded by
  `validator.isEmail(req.body.username)`, so an object there does not reach the query. See
  `exploits/nosql-exploits.sh` — the `ns4` alias works; the `ns5` alias (object username) no
  longer bypasses login because of that guard.
- **Command injection** — `exports.create` in `routes/index.js` builds `exec('identify ' + url)`
  from a URL parsed out of user-supplied todo content. See `exploits/shell-injection.md`.
- **Zip Slip / path traversal on extraction** — `exports.import` in `routes/index.js` feeds an
  uploaded archive to `AdmZip(...).extractAllTo('/tmp/extracted_files', true)` with
  `adm-zip@0.4.7`. See `exploits/zip-slip`.
- **Prototype pollution** — the chat handler in `routes/index.js` does
  `_.merge(message, req.body.message, ...)` with `lodash@4.17.4`; the TypeORM user routes in
  `routes/users.js` log `{}.where` to show the polluted prototype leaking into queries. See
  `exploits/prototype-pollution.sh` and `exploits/prototype-pollution-typeorm.md`.
- **Local file inclusion via template `layout`** — `save_account_details` in `routes/index.js`
  passes the whole request body into the Handlebars view, so an attacker-controlled `layout`
  property (e.g. `./../package.json`) is rendered.
- **ReDoS** — `validator.isEmail(..., { allow_display_name: true })` and `validator.rtrim()` in
  `save_account_details`; also the `ms` / `humanize-ms` parsing in the `parse()` helper.
- **Open redirect** — `adminLoginSuccess` in `routes/index.js` redirects to the
  attacker-supplied `redirectPage` form field.
- **XSS** — unescaped template output in `views/` (e.g. the `redirectPage` hidden input in the
  admin view) plus the `marked` and `dustjs` sinks.
- **Hardcoded secrets / plaintext credentials** — `token` in `app.js`, the
  `secret: 'keyboard cat'` session key in `app.js`, the seeded admin
  `admin@snyk.io`/`SuperSecretPassword` in `mongoose-db.js`, and `root`/`root` MySQL
  credentials in `typeorm-db.js`. Passwords are stored and compared in plaintext.
- **Security misconfiguration** — `errorhandler` stack traces, debug port exposure, HTTP-only
  transport.

### Dependency-level (Snyk Open Source)

`package.json` deliberately pins old versions, including `adm-zip@0.4.7`, `lodash@4.17.4`,
`marked@0.3.5`, `mongoose@4.2.4`, `ms@^0.7.1`, `humanize-ms@1.0.1`, `st@0.2.4`, `ejs@1.0.0`,
`dustjs-linkedin@2.5.0`, `express@4.12.4`, `body-parser@1.9.0`, `express-fileupload@0.0.5`,
`jquery@^2.2.4`, `moment@2.15.1`, and `validator@^13.5.2`. The `Dockerfile` base image is also
intentionally outdated for container scanning demos.

## Guidance for remediating findings here

This repo is a scan-workflow fixture, so remediation is a demo artifact, not a cleanup task.

1. **Only remediate when the demo asks for it.** Default answer to a finding is "expected".
2. **One finding, or one finding-class, per PR.** Never batch unrelated fixes, and never run a
   blanket `snyk fix` / dependency upgrade across the manifest.
3. **Say it is intentional.** Every remediation PR description must state that the change
   deliberately removes part of the vulnerable baseline, name the finding (rule ID / CVE /
   file and function), and note which demos depend on it.
4. **Keep the exploit material in sync.** If you fix something covered by `exploits/`, say so;
   do not silently leave a broken exploit script behind.
5. **Prefer additive demos.** Where possible, demonstrate a fix on a branch rather than merging
   it to `main`, so the baseline scan result stays stable.
6. **Do not touch `package-lock.json`, `Dockerfile`, or `docker-compose.yml`** as a side effect
   of an unrelated change — lockfile churn silently changes the dependency scan baseline.
