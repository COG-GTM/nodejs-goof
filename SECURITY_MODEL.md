# nodejs-goof threat model

Status: drafted from the code, with the user's facts marked **(user)**.

## System overview
Goof started as Snyk's deliberately vulnerable Express todo demo app (`README.md`, `package.json` description "A vulnerable todo demo application"). **(user)** This deployment is internet-facing and handles user data, so its flaws are treated as real, not as demo content.

It runs as one Node.js process (`app.js`, port 3001) with two backing stores:
- MongoDB through mongoose (`mongoose-db.js`): todos, plus an admin user seeded as `admin@snyk.io`.
- MySQL through TypeORM (`typeorm-db.js`, `entity/Users.js`): a `Users` table seeded at startup, with hard-coded root credentials.

It is deployed with `Dockerfile` (node:18.13.0) and `docker-compose.yml` (mongo:3, mysql:5, ports 3001/9229/27017/3306 exposed), or to Heroku (`app.json`, `deploy-heroku.md`).

## Components
| Component | Code |
|---|---|
| Web app | `app.js`, `routes/index.js`, `routes/users.js`, `views/`, `public/`, `utils.js` |
| Data layer | `mongoose-db.js`, `typeorm-db.js`, `entity/` |
| Dependencies | `package.json`, `package-lock.json` (third-party npm code) |
| Infrastructure | `Dockerfile`, `docker-compose.yml`, `app.json`, `.github/workflows/` |

## Trust boundaries and entry points
- **Internet → Web app (port 3001):** **(user)** the app is reachable from the internet. Almost every route is anonymous:
  - todos: `GET /`, `POST /create`, `GET /destroy/:id`, `GET /edit/:id`, `POST /update/:id`
  - file upload: `POST /import` (`express-fileupload`, zip extracted with `adm-zip` to `/tmp/extracted_files`)
  - templates: `GET /about_new` (dust template with `req.query.device`)
  - chat: `GET/PUT/DELETE /chat` (checks in-memory credentials, merges the body with `_.merge`)
  - users: `GET/POST /users` (TypeORM)
  - static: `/public` (`st`)
  - login: `GET/POST /login`
- **Session-gated:** `/admin` and `/account_details` require `req.session.loggedIn === 1`, which `POST /login` sets (`routes/index.js` `loginHandler`, a mongoose `User.find` built from the request body).
- **Web app → OS shell:** `POST /create` calls `child_process.exec('identify ' + url)` (`routes/index.js`).
- **Web app → databases:** MongoDB and MySQL. Credentials are hard-coded or come from env vars (`MONGOLAB_URI`, `MONGODB_URI`, CloudFoundry).
- **Debug port 9229** is exposed in Docker.

## Assets
- **(user)** User data: MongoDB user records and admin credentials, MySQL `Users` (name, address, role), and account details saved through `/account_details`.
- The server host and container: code execution through shell, template or prototype-pollution sinks, and file write through archive extraction. Host compromise reaches the user data above.
- Todos and chat messages.
- Secrets in source: the session secret and a hard-coded token in `app.js`.

## Attacker profiles
- **(user, implied by internet-facing)** An anonymous internet user who can reach port 3001. This is the main attacker; no attacker class is ruled out.

## Existing controls
- `marked` runs with `sanitize: true` (`app.js`).
- `validator.isEmail` checks the login username. `validator` checks on `/account_details`.
- A session flag protects `/admin` and `/account_details`. Chat add and delete need in-memory user credentials (delete needs `canDelete`).

## Out of scope / accepted risk
- None stated by the user. Being internet-facing with user data, nothing is accepted as demo-only risk.

## Open questions
- Which user data matters most (credentials, addresses, account details)?
- Are any parts out of scope: devDependencies, `exploits/`, `tests/`, the Heroku and CloudFoundry paths?
