# Goof - Snyk's vulnerable demo app (Python port)
[![Known Vulnerabilities](https://snyk.io/test/github/snyk/goof/badge.svg?style=flat-square)](https://snyk.io/test/github/snyk/goof)

A vulnerable **Python / Flask** demo application, ported from the original
Node.js/Express [`nodejs-goof`](https://github.com/snyk-labs/nodejs-goof) (itself
based on the [Dreamers Lab tutorial](http://dreamerslab.com/blog/en/write-a-todo-list-with-express-and-mongodb/)).

The port keeps the same routes and, importantly, the same **intentional
vulnerabilities** so the existing exploit walkthroughs still work. Stack mapping:

| Original (Node) | Python port |
|-----------------|-------------|
| Express | Flask |
| EJS / Handlebars / Dust views | Jinja2 templates (`render_template_string` for the injectable routes) |
| Mongoose (MongoDB) | PyMongo |
| TypeORM (MySQL) | SQLAlchemy + PyMySQL |
| `marked` | `markdown` |
| `adm-zip` | `zipfile` |

## Features

This vulnerable app includes the following capabilities to experiment with:
* [Exploitable packages](#exploiting-the-vulnerabilities) with known vulnerabilities
* [Docker Image Scanning](#docker-image-scanning) for base images with known vulnerabilities in system libraries
* [Runtime alerts](#runtime-alerts) for detecting an invocation of vulnerable functions in open source dependencies

## Running
```bash
git clone https://github.com/COG-GTM/nodejs-goof
cd nodejs-goof

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# start the databases (see docker commands below)
python app.py
```
This will run Goof locally, connecting to a local MongoDB and MySQL and listening
on port 3001 (http://localhost:3001).

The app needs MongoDB (todos + users) and MySQL (the `acme.users` table). The
easiest way to get both is Docker:

```sh
docker run -d --rm -p 27017:27017 --name goof-mongo mongo:4.4
docker run -d --rm -p 3306:3306 --name goof-mysql \
  -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=acme mysql:5.7
```

The app still boots if a database is unavailable — only the routes that touch
that database will error.

## Running with docker-compose
```bash
docker-compose up --build
docker-compose down
```

### Heroku usage
Goof requires attaching a MongoLab service to be deployed as a Heroku app. 
That sets up the MONGOLAB_URI env var so everything after should just work. 

### CloudFoundry usage
Goof requires attaching a MongoLab service and naming it "goof-mongo" to be deployed on CloudFoundry. 
The code explicitly looks for credentials to that service. 

### Tests
Run the test suite with:
```bash
pytest
```

### Cleanup
To bulk delete the current list of TODO items from the DB run:
```bash
mongo express-todo --eval 'db.todos.remove({});'
```

## Exploiting the vulnerabilities

This app contains insecure code that introduces code-level vulnerabilities. The
exploit walkthroughs are HTTP-based (`curl` / `httpie`), so they apply equally to
this Python port and to the original Node app.

The `exploits/` directory includes a series of steps to demonstrate each one.

### Vulnerabilities in open source dependencies

The original Node app demonstrated dependency vulnerabilities through these npm
packages. The Python port re-implements the equivalent **code-level** behaviour
(ReDoS-prone reminder parsing, markdown XSS, zip traversal) in pure Python rather
than depending on the vulnerable npm modules:
- [Mongoose - Buffer Memory Exposure](https://snyk.io/vuln/npm:mongoose:20160116)
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

#### Code injection (Server-Side Template Injection)

The page at `/account_details` is rendered as a Jinja2 template
(`render_template_string` in `routes/main.py`).

The same view is used for both the GET request which shows the account details, as well as the form itself for a POST request which updates the account details. A so-called Server-side Rendering.

The form is completely functional. The way it works is, it receives the profile information from the request body and passes it, as-is, into the template. The `firstname` field flows **unescaped into the template source**, which means the attacker controls data that the template engine evaluates — the Python equivalent of the original Handlebars template-injection bug.

This leads to Server-Side Template Injection (SSTI). Here is a proof-of-concept showing it (log in first, then submit a `firstname` payload):

```sh
curl -X 'POST' --cookie c.txt --cookie-jar c.txt -H 'Content-Type: application/json' --data-binary '{"username": "admin@snyk.io", "password": "SuperSecretPassword"}' 'http://localhost:3001/login'
```

```sh
curl -X 'POST' --cookie c.txt --cookie-jar c.txt -H 'Content-Type: application/json' --data-binary '{"email": "admin@snyk.io", "firstname": "{{7*7}}", "lastname": "admin", "country": "IL", "phone": "+972551234123"}' 'http://localhost:3001/account_details'
```

The response will contain `Account details for: 49`, proving the template engine
evaluated the injected `{{7*7}}` expression.

Actually, there's even another vulnerability in this code.
The input validation (`validators.py`) uses regular expressions that, like the original `validator` library, can exhibit catastrophic backtracking (ReDoS) on crafted long inputs against the email/profile fields of this route:

```sh
curl -X 'POST' -H 'Content-Type: application/json' --data-binary "{\"email\": \"$(python3 -c 'print("<"*100000)')\"}" 'http://localhost:3001/account_details'
```

#### NoSQL injection

A POST request to `/login` will allow for authentication and signing-in to the system as an administrator user.
It works by exposing `login_handler` as a controller in `routes/main.py` and uses a MongoDB database and the `User.find()` query to look up the user's details (email as a username and password). One issue is that it indeed stores passwords in plaintext and not hashing them. However, there are other issues in play here.


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

The `/admin` view introduces a `redirectPage` query path, as follows in the admin view (`templates/admin.html`):

```
<input type="hidden" name="redirectPage" value="{{ redirectPage|safe }}" />
```

One fault here is that the `redirectPage` is rendered as raw HTML and not properly escaped, because it uses the `|safe` filter which disables Jinja2 autoescaping. That itself, introduces a Cross-site Scripting (XSS) vulnerability via:

```
http://localhost:3001/login?redirectPage="><script>alert(1)</script>
```

To exploit the open redirect, simply provide a URL such as `redirectPage=https://google.com` which exploits the fact that `admin_login_success` in `routes/main.py` doesn't enforce local URLs.

#### Hardcoded values - session information

The application initializes a cookie-based session in `app.py` as follows:

```python
app.secret_key = "keyboard cat"
app.config["SESSION_COOKIE_NAME"] = "connect.sid"
```

As you can see, the session `secret` used to sign the session is hardcoded sensitive information inside the code.

First attempt to fix it, can be to move it out to a config module such as:
```python
COOKIE_SECRET = "keyboard cat"
```

And then import the configuration module and use it to initialize the session.
However, that still maintains the secret information inside another file, and Snyk Code will warn you about it. The recommended fix is to read it from an environment variable / secrets manager instead.

There is also a hardcoded `token` value in `app.py`, mirroring the original.

## Docker Image Scanning

The `Dockerfile` makes use of a base image (`python:3.12-slim`) that may have system libraries with known vulnerabilities.

To scan the image for vulnerabilities, run:
```bash
snyk test --docker python:3.12-slim --file=Dockerfile
```

To monitor this image and receive alerts with Snyk:
```bash
snyk monitor --docker python:3.12-slim
```

## Runtime Alerts

Snyk provides the ability to monitor application runtime behavior and detect an invocation of a function is known to be vulnerable and used within open source dependencies that the application makes use of.

The app is started from [app.py](./app.py).

## Fixing the issues
To find dependency flaws in this application (and in your own apps), run:
```
npm install -g snyk
snyk test
snyk code test
```

Review the findings, then fix them and run the exploits again to confirm they are resolved.
