# Migration notes: nodejs-goof to the x86 Kubernetes platform

App migration wave target: Node 22 LTS, `linux/amd64` container image built in GitHub Actions, plain Kubernetes YAML in the infra repo (`platform/dev/nodejs-goof/`), network zone `internet`.

> This app is an intentionally vulnerable demo. The migration keeps its vulnerable dependencies and code paths as they are (they are the point of the app) and only changes what is needed to run on Node 22 in a container.

## Runtime and package manager (today)

| Item | Value | Source |
| --- | --- | --- |
| Node | 18.13.0 | `Dockerfile` (`FROM node:18.13.0`); no `engines`, no `.nvmrc` |
| Package manager | npm, lockfile v2 | `package-lock.json` |
| Start | `NODE_OPTIONS=--openssl-legacy-provider node app.js` | `package.json` `start` |
| Build | none at runtime; `npm run build` (browserify jQuery bundle) is optional and its output is not committed or used by the views | `package.json` |
| Image build | `npm update` then `npm install` inside a full `node` image, runs as root, copies the whole repo (no `.dockerignore`) | `Dockerfile` |
| CI | `snyk-code-manual.yml` (uploads a static SARIF file, every push/PR), `codeql-analysis.yml` (targets `master`, which does not exist; default branch is `main`) | `.github/workflows/` |
| Tests | `npm test` = `snyk test` (dependency vulnerability scan, needs `SNYK_TOKEN`, fails by design on this app); `tests/authentication.component.spec.js` is not wired to any runner and does not parse (`require('assert)')`) | `package.json`, `tests/` |

## Packages with known Node 22 breaks

| Package | Version | Break on Node 22 / OpenSSL 3 | Action |
| --- | --- | --- | --- |
| `etag` (via `express@4.12.4` and `send@0.12.3`) | 1.6.0 | Hashes bodies over the CRC threshold with `md4`, which OpenSSL 3 removed: every rendered page larger than ~1 KB returns 500 `error:0308010C:digital envelope routines::unsupported`. This is why the start script carries `--openssl-legacy-provider`. | Override to `etag@^1.8.1` (uses `sha1`, same API) and drop the legacy flag |
| `kerberos` (optional dep of `mongodb-core`) | 0.0.24 | Native addon with an install script; needs a compiler toolchain at install time | Built in the build stage only; runtime stage copies the result. Optional: the app does not use Kerberos auth |
| `graceful-fs` (via `st@0.2.4`) | 1.2.3 | Pre-4.x graceful-fs; works for `st` static serving on Node 22 (verified), deprecation warning only | Keep (part of the `st` vulnerability demo) |
| `mongoose` / `mongodb` driver | 4.2.4 / 2.0.46 | Driver only speaks the legacy wire protocol; works with MongoDB server 3.6, not with 5.x+ servers | Keep; datastore stays on MongoDB 3.6 |
| `mysql` | 2.18.1 | No `caching_sha2_password` support: MySQL 8 default users fail | Keep; datastore stays on MySQL 5.7 |
| misc (`util._extend`, `OutgoingMessage._headers`) | - | Deprecation warnings only | None |

## Datastores, caches, buckets, external APIs

| Kind | What | Where it is read |
| --- | --- | --- |
| MongoDB (`express-todo` db; collections `todos`, `users`) | Todo items and the seeded admin user | `mongoose-db.js` |
| MySQL (`acme` db; table `users`, created by TypeORM `synchronize`) | Seeded user records for `/users` | `typeorm-db.js` (host/port/user/password/db were hard-coded to `localhost`/`root`) |
| Cache | none (express-session uses the in-memory store) | `app.js` |
| Buckets / object storage | none. Uploads to `/import` are read in memory; zip uploads extract to `/tmp/extracted_files` on local disk | `routes/index.js` |
| External APIs | none at runtime. `/create` shells out to ImageMagick `identify` for image URLs (part of the command-injection demo; not installed in the image, failure is logged only) | `routes/index.js` |

## Environment variables

| Variable | Read in | Purpose |
| --- | --- | --- |
| `PORT` | `app.js` | HTTP port, default 3001 |
| `NODE_ENV` | `app.js` (`app.get('env')`) | `development` enables `errorhandler` |
| `MONGODB_URI` / `MONGOLAB_URI` | `mongoose-db.js` | Mongo connection string (wins over defaults) |
| `DOCKER` | `mongoose-db.js` | `1` switches the default Mongo host to `goof-mongo` |
| `VCAP_SERVICES` (via `cfenv`, service `goof-mongo`) | `mongoose-db.js` | CloudFoundry binding, highest precedence |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | `typeorm-db.js` (new) | MySQL connection; defaults keep the previous local values |

## Ports

- 3001 HTTP (app). 9229 was exposed for the inspector; not exposed in the new image.
- Health routes: `GET /healthz` is process liveness (container `HEALTHCHECK`, Kubernetes liveness probe); `GET /readyz` returns 503 until both MongoDB and MySQL are connected (Kubernetes readiness probe).

## Secrets today

- Nothing is injected at build time; the old Dockerfile copied the whole working tree (any local `.env` or `node_modules` would have ended up in the image).
- Hard-coded in code (intentional demo findings, left as is): session secret in `app.js`, a token printed at startup in `app.js`, seeded admin credentials in `mongoose-db.js`, MySQL `root`/`root` defaults in `typeorm-db.js`.
- On the platform, `MONGODB_URI` and the MySQL credentials come from the Crossplane claim connection secrets; nothing is baked into the image.

## Target design

| Concern | Today | Target |
| --- | --- | --- |
| Compute | Heroku / CloudFoundry / docker-compose with `node:18.13.0` | Deployment in `platform/dev/nodejs-goof/`, image `nodejs-goof@sha256:...` built for `linux/amd64` from the multi-stage `Dockerfile` (Node 22 slim runtime, non-root, `HEALTHCHECK`) |
| MongoDB | MongoLab / local `mongo:3` | Moves: `internet` zone has no path to the old network, so a Crossplane `MongoDBInstance` claim (engine 3.6) with data moved by `scripts/migrate-data.sh` (`mongodump`/`mongorestore`) |
| MySQL | local `mysql:5` | Moves: Crossplane `MySQLInstance` claim (engine 5.7) with data moved by `scripts/migrate-data.sh` (`mysqldump`/restore) |
| Object storage | none | Nothing to move; MinIO is in `docker-compose.migration.yml` only as the platform's S3 stand-in |
| Network path | - | Ingress (internet) -> Service :80 -> pod :3001; pod -> claim endpoints for MongoDB (27017) and MySQL (3306) |
| CI | static SARIF upload, CodeQL on a non-existent branch | `container-image.yml`: install, existing tests, smoke test, buildx `linux/amd64` on PRs and pushes to `main`; internal registry push gated on registry secrets |
