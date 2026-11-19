# Goof - Snyk's demo todo app (Java 21 / Spring Boot)

A todo list demo app, originally a vulnerable Node.js/Express app based on the
[Dreamers Lab tutorial](http://dreamerslab.com/blog/en/write-a-todo-list-with-express-and-mongodb/),
now migrated to **Java 21 + Spring Boot 4**. Pages, routes, data stores and behaviour are the same as the
Node.js build; the JSON API is also exposed under `/api/v1` and documented with OpenAPI 3.

| | |
|---|---|
| Language / runtime | Java 21 |
| Framework | Spring Boot 4.1 (Web MVC, Thymeleaf, Security, Data MongoDB, Data JPA, Actuator) |
| API contract | [`api-spec/openapi.yaml`](api-spec/openapi.yaml) (OpenAPI 3.1), Swagger UI at `/swagger-ui.html` |
| Storage | MongoDB (todos, admin login), MySQL (`users` table) |
| Build | Maven (wrapper included) |
| Tests | JUnit 5, Mockito, MockMvc, Testcontainers |

## Running locally

Requirements: JDK 21, Docker (for the databases and the integration tests).

```bash
docker run -d --name goof-mongo -p 27017:27017 mongo:7
docker run -d --name goof-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=acme mysql:8.4

./mvnw spring-boot:run            # or: ./mvnw package && java -jar target/goof-2.0.0-SNAPSHOT.jar
```

The app listens on http://localhost:3001. Use `-Dspring-boot.run.profiles=dev` to disable template caching.

### Configuration

All settings come from environment variables (defaults in `src/main/resources/application.yml`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `MONGODB_URI` (or `MONGOLAB_URI`) | `mongodb://localhost:27017/express-todo` | Todos and admin login |
| `MYSQL_URL` | `jdbc:mysql://localhost:3306/acme?createDatabaseIfNotExist=true` | `users` table |
| `MYSQL_USER` / `MYSQL_PASSWORD` | `root` / `root` | MySQL credentials |
| `GOOF_ADMIN_USERNAME` / `GOOF_ADMIN_PASSWORD` | `admin@snyk.io` / `SuperSecretPassword` | Admin account seeded on first start (demo only; override it) |

On startup the app seeds the admin login (MongoDB, BCrypt-hashed) and the users `Liran` and `Simon` (MySQL) if
they are missing. Admin passwords stored in plaintext by the Node.js build still work and are re-hashed on login.

### Docker

```bash
docker compose up --build     # app + MongoDB 7 + MySQL 8.4
docker compose down
```

## Pages and API

| Route | Description |
|---|---|
| `GET /` | Todo list (Markdown rendered, raw HTML escaped) |
| `POST /create`, `GET /edit/{id}`, `POST /update/{id}`, `GET /destroy/{id}` | Todo CRUD forms. `Walk the dog in 2 hours` is stored as `Walk the dog [2h]` |
| `POST /import` | Import todos from a CSV (`what[,when,locale,format]`) or a ZIP with a `backup.txt` |
| `GET /login`, `POST /login`, `GET /logout` | Admin login (`redirectPage` must be a local path) |
| `GET /admin`, `GET/POST /account_details` | Admin pages (login required); account details form with validation |
| `GET /about_new?device=Desktop` | About page |
| `/chat`, `/users` | Legacy JSON endpoints (same as `/api/v1/chat`, `/api/v1/users`) |
| `/api/v1/todos[/{id}]` | Versioned JSON todo API |
| `/v3/api-docs`, `/swagger-ui.html` | Generated OpenAPI document and Swagger UI |
| `/actuator/health`, `/actuator/prometheus` | Health probes and metrics |

API errors use one JSON shape (`ApiError`: `timestamp`, `status`, `error`, `message`, `path`, `details`),
produced by `GlobalExceptionHandler` (`@ControllerAdvice`).

## Testing

```bash
./mvnw verify
```

- `*Test` (Surefire): unit tests for reminder parsing, Moment-style date formatting, Markdown sanitising,
  import, validation, login redirects, chat, and OpenAPI spec validation.
- `*IT` (Failsafe): full-application tests against MongoDB and MySQL Testcontainers, plus
  `OpenApiContractIT`, which fails when the code drifts from `api-spec/openapi.yaml`.

### Parity with the Node.js build

`parity/` holds a black-box harness that replays the same 39-request user journey against a running instance
and compares the result with the recorded Node.js baseline. See [`parity/README.md`](parity/README.md).

## Security notes

The Node.js build was intentionally vulnerable (NoSQL injection, prototype pollution, Zip Slip, open redirect,
XSS, template injection, hard-coded session secret, vulnerable npm packages). The Java build does not port those
flaws: queries are typed, ZIP imports are read in memory, `redirectPage` must be local, templates escape output,
passwords are hashed, CSRF protection is on for HTML forms, and no secrets are hard-coded beyond the demo admin
default above. The `exploits/` directory documents the attacks against the original Node.js build.
