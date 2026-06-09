# Goof (Python/Flask)

A **deliberately vulnerable** demo application — the Snyk "goof" app — implemented as a
simple "TODO list" service. This version has been **migrated from the original
Node.js/Express app to Python/Flask**. It exists purely for security education,
testing, and demonstration of how vulnerabilities are introduced, found, and fixed.

> ⚠️ **WARNING: DO NOT deploy this application to production or expose it to the
> public internet.** It contains intentional, exploitable security flaws. Run it
> only on a local machine or an isolated, throwaway environment.

## Overview

Goof is a small Flask web app backed by **MongoDB** (todo items) and **MySQL**
(supporting data). It intentionally ships with a collection of common web
vulnerabilities so that security tooling (such as Snyk) and learners can
practice identifying and remediating real-world issue classes.

- Framework: **Flask** (Python)
- Datastores: **MongoDB** + **MySQL**
- Listens on port **3001**

## Setup

You can run Goof either with Docker Compose (recommended — it brings up the app
plus both databases) or locally against your own database instances.

### Option 1: Docker Compose (recommended)

This starts the Flask app together with MongoDB and MySQL:

```bash
docker-compose up
```

The app will be available at http://localhost:3001.

### Option 2: Local

The app needs **MongoDB** and **MySQL** running and reachable before it will
work. Once those are available:

```bash
pip install -r requirements.txt
python app.py
```

The app will start on port **3001** (http://localhost:3001).

## Intentional Vulnerabilities

The following flaws are **intentional**. They are the whole point of this app —
do not "fix" them unless you are specifically practicing remediation.

- **NoSQL Injection** — `POST /login`
  Login input is passed into a MongoDB query without sanitization, so query
  operators (e.g. `{"$gt": ""}`) can be injected to bypass authentication.

- **Command Injection** — `POST /create` (via image URL)
  The supplied image URL is incorporated into a shell command, allowing an
  attacker to append/inject arbitrary OS commands.

- **Zip Slip** — `POST /import`
  An uploaded ZIP archive is extracted without validating entry paths, so
  entries like `../../evil` can write files outside the intended directory
  (path traversal during extraction).

- **Prototype-Pollution-equivalent recursive merge** — `PUT /chat`
  A recursive deep-merge of user-controlled input mirrors the JavaScript
  prototype-pollution class, letting attackers inject/override unexpected
  object keys.

- **Open Redirect** — `POST /login` (`redirectPage` parameter)
  The `redirectPage` value is used to redirect the user without validation,
  enabling redirects to attacker-controlled external sites.

- **Server-Side Template Injection (SSTI)** — `GET /about_new` (`device` parameter)
  The `device` parameter is rendered into a template unsafely, allowing
  template expression injection and potential remote code execution.

- **Hardcoded Credentials**
  The app ships with hardcoded admin credentials: `admin@snyk.io` /
  `SuperSecretPassword`.

## Disclaimer

This software is intentionally insecure and is provided solely for educational
and testing purposes. Use it only in isolated environments you control. **Never
deploy it to production or the public internet.**
