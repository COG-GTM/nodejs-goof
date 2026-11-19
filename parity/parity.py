#!/usr/bin/env python3
"""Black-box parity harness for the Goof todo app.

Replays the same scripted user journey against a running instance and records,
per request: method, path, status, base content type, Location (path only) and a
normalized body (HTML reduced to the elements the UI depends on, JSON with
volatile fields masked). Output is one JSON file that can be diffed between the
legacy Node.js build and the Java 21 build.

Usage:
  python3 parity/parity.py --base http://localhost:3001 --out parity/baseline/node.json
  python3 parity/parity.py --base http://localhost:8080 --out parity/after/java.json \
      --compare parity/baseline/node.json

The todos collection must be empty and the app freshly started before a run.
Only the Python standard library is used.
"""
import argparse
import html
import http.cookiejar
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Client:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar), NoRedirect())
        self.csrf = None

    def request(self, method, path, data=None, headers=None):
        req = urllib.request.Request(self.base + path, data=data, method=method,
                                     headers=headers or {})
        try:
            resp = self.opener.open(req, timeout=20)
        except urllib.error.HTTPError as err:
            resp = err
        body = resp.read()
        text = body.decode("utf-8", errors="replace")
        m = re.search(r'name="_csrf"\s+value="([^"]+)"', text) or \
            re.search(r'value="([^"]+)"\s+name="_csrf"', text)
        if m:
            self.csrf = m.group(1)
        return resp.status, resp.headers, text

    def form(self, path, fields):
        fields = dict(fields)
        if self.csrf:
            fields["_csrf"] = self.csrf
        data = urllib.parse.urlencode(fields).encode()
        return self.request("POST", path, data,
                            {"Content-Type": "application/x-www-form-urlencoded"})

    def multipart(self, path, name=None, filename=None, content=b""):
        boundary = uuid.uuid4().hex
        parts = []
        if self.csrf:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="_csrf"\r\n\r\n{self.csrf}\r\n'.encode())
        if name:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                         f'Content-Type: application/octet-stream\r\n\r\n'.encode() + content + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        return self.request("POST", path, b"".join(parts),
                            {"Content-Type": f"multipart/form-data; boundary={boundary}"})

    def json(self, method, path, payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        headers = {"Content-Type": "application/json"} if data else {}
        return self.request(method, path, data, headers)


def strip_tags(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def html_features(text):
    """Reduce an HTML page to the user-visible elements the journey checks."""
    feats = {}
    titles = [strip_tags(t) for t in re.findall(r'<h1[^>]*id="page-title"[^>]*>(.*?)</h1>', text, re.S)]
    if titles:
        feats["page_title"] = titles
    h2 = [strip_tags(t) for t in re.findall(r"<h2[^>]*>(.*?)</h2>", text, re.S)]
    if h2:
        feats["h2"] = h2
    items = re.findall(r'<a class="update-link"[^>]*>(.*?)</a>', text, re.S)
    if items:
        feats["todo_items"] = [strip_tags(i) for i in items]
        feats["todo_items_markup"] = [re.sub(r"\s+", " ", i).strip() for i in items]
    edit = re.findall(r'class="update-input"[^>]*value="([^"]*)"', text)
    if edit:
        feats["edit_value"] = [html.unescape(v) for v in edit]
    inputs = sorted(set(n for n in re.findall(r'<input[^>]*name="([^"]+)"', text) if n != "_csrf"))
    if inputs:
        feats["form_inputs"] = inputs
    redirect = re.findall(r'name="redirectPage"\s+value="([^"]*)"', text)
    if redirect:
        feats["redirect_page"] = redirect
    for marker in ("details saved", "Device string (debug)", "The BESTest todo app evar"):
        if marker in text:
            feats.setdefault("markers", []).append(marker)
    m = re.search(r"Device string \(debug\): ([^<]*)<", text)
    if m:
        feats["device"] = m.group(1).strip()
    return feats


VOLATILE = {"id", "timestamp", "_id", "__v"}


def mask(value):
    if isinstance(value, dict):
        return {k: ("<masked>" if k in VOLATILE and k != "id" or (k == "id" and not isinstance(v, int)) else mask(v))
                for k, v in sorted(value.items())}
    if isinstance(value, list):
        return [mask(v) for v in value]
    return value


def mask_chat(value):
    if isinstance(value, list):
        return [{k: ("<masked>" if k in ("id", "timestamp") else v) for k, v in sorted(m.items())} for m in value]
    return mask(value)


def record(log, label, method, path, result, body_mode="auto", chat=False):
    status, headers, text = result
    ctype = (headers.get("Content-Type") or "").split(";")[0].strip().lower() or None
    location = headers.get("Location")
    if location:
        location = urllib.parse.urlsplit(location)._replace(scheme="", netloc="").geturl() or "/"
    if body_mode == "none" or status in (301, 302, 303) and body_mode == "auto":
        body = None
    elif body_mode == "raw":
        body = text.strip()
    elif ctype == "application/json" or body_mode == "json":
        try:
            parsed = json.loads(text) if text.strip() else None
        except ValueError:
            parsed = text.strip()
        body = mask_chat(parsed) if chat else mask(parsed)
    elif ctype == "text/html":
        body = html_features(text)
    else:
        body = {"length_gt_0": len(text) > 0}
    if body is None:
        ctype = None  # body-less redirects/401s: content type is framework noise
    entry = {"step": label, "method": method, "path": path, "status": status,
             "content_type": ctype, "location": location, "body": body}
    log.append(entry)
    return entry


def run(base):
    c = Client(base)
    log = []

    def get(label, path, **kw):
        return record(log, label, "GET", path, c.request("GET", path), **kw)

    get("home (empty)", "/")
    r = c.form("/create", {"content": "Walk the dog in 2 hours"})
    record(log, "create todo with reminder", "POST", "/create", r, body_mode="raw")
    r = c.form("/create", {"content": "Buy **milk**"})
    record(log, "create markdown todo", "POST", "/create", r, body_mode="raw")
    r = c.form("/create", {"content": "Meet <b>Bob</b>"})
    record(log, "create todo with html", "POST", "/create", r, body_mode="raw")
    home = c.request("GET", "/")
    record(log, "home (3 todos)", "GET", "/", home)
    ids = re.findall(r'href="/edit/([0-9a-f]+)"', home[2])
    first = ids[0] if ids else "missing"
    get("edit first todo", f"/edit/{first}")
    r = c.form(f"/update/{first}", {"content": "Updated item"})
    record(log, "update first todo", "POST", "/update/{id}", r)
    get("home after update", "/")
    r = c.request("GET", f"/destroy/{first}")
    record(log, "destroy first todo", "GET", "/destroy/{id}", r)
    get("home after destroy", "/")

    csv = (ROOT.parent / "exploits" / "moment-todo-good.csv").read_bytes() \
        if (ROOT.parent / "exploits" / "moment-todo-good.csv").exists() else \
        b"Bake a cake\nWalk the dog in 2 hours\nTravel to Thailand,2017-01-01,be,YYYY-MM-DD\n"
    c.request("GET", "/")
    r = c.multipart("/import", "importFile", "todos.csv", csv)
    record(log, "import csv", "POST", "/import", r)
    get("home after import", "/")
    c.request("GET", "/")
    r = c.multipart("/import")
    record(log, "import without file", "POST", "/import", r, body_mode="raw")

    get("admin (anonymous)", "/admin")
    get("account details (anonymous)", "/account_details")
    get("login page", "/login")
    get("login page with redirect", "/login?redirectPage=/account_details")
    r = c.form("/login", {"username": "not-an-email", "password": "x"})
    record(log, "login invalid email", "POST", "/login", r, body_mode="none")
    c.request("GET", "/login")
    r = c.form("/login", {"username": "admin@snyk.io", "password": "wrong"})
    record(log, "login wrong password", "POST", "/login", r, body_mode="none")
    c.request("GET", "/login")
    r = c.form("/login", {"username": "admin@snyk.io", "password": "SuperSecretPassword"})
    record(log, "login success", "POST", "/login", r)
    get("admin (logged in)", "/admin")
    get("account details (empty)", "/account_details")
    r = c.form("/account_details", {"firstname": "John  ", "lastname": "Doe", "country": "IL",
                                    "phone": "0541234567", "email": "John Doe <john@example.com>"})
    record(log, "save account details (valid)", "POST", "/account_details", r)
    c.request("GET", "/account_details")
    r = c.form("/account_details", {"firstname": "John", "lastname": "Doe", "country": "IL",
                                    "phone": "123", "email": "john@example.com"})
    record(log, "save account details (invalid phone)", "POST", "/account_details", r)
    get("logout", "/logout")
    get("admin after logout", "/admin")
    c.request("GET", "/login")
    r = c.form("/login", {"username": "admin@snyk.io", "password": "SuperSecretPassword",
                          "redirectPage": "/account_details"})
    record(log, "login with redirectPage", "POST", "/login", r)
    c.request("GET", "/logout")

    get("about_new desktop", "/about_new?device=Desktop")
    get("about_new mobile", "/about_new?device=Mobile")

    record(log, "chat list (empty)", "GET", "/chat", c.json("GET", "/chat"), chat=True)
    record(log, "chat add (bad auth)", "PUT", "/chat",
           c.json("PUT", "/chat", {"auth": {"name": "user", "password": "nope"}, "message": {"text": "hi"}}), chat=True)
    record(log, "chat add (user)", "PUT", "/chat",
           c.json("PUT", "/chat", {"auth": {"name": "user", "password": "pwd"}, "message": {"text": "hi"}}), chat=True)
    record(log, "chat add custom icon", "PUT", "/chat",
           c.json("PUT", "/chat", {"auth": {"name": "user", "password": "pwd"},
                                   "message": {"text": "yo", "icon": "*"}}), chat=True)
    record(log, "chat list (2 messages)", "GET", "/chat", c.json("GET", "/chat"), chat=True)
    record(log, "chat delete (user not allowed)", "DELETE", "/chat",
           c.json("DELETE", "/chat", {"auth": {"name": "user", "password": "pwd"}, "messageId": 1}), chat=True)

    record(log, "users list", "GET", "/users", c.json("GET", "/users"))
    record(log, "users create", "POST", "/users",
           c.json("POST", "/users", {"name": "Ada", "address": "UK", "role": "user"}), body_mode="raw")

    get("static css", "/public/css/screen.css")
    get("static about page", "/public/about.html")
    return log


def compare(before, after):
    mismatches = []
    for b, a in zip(before, after):
        for key in ("status", "content_type", "location", "body"):
            if b.get(key) != a.get(key):
                mismatches.append({"step": b["step"], "field": key, "before": b.get(key), "after": a.get(key)})
    if len(before) != len(after):
        mismatches.append({"step": "<count>", "field": "steps", "before": len(before), "after": len(after)})
    return mismatches


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--compare")
    ap.add_argument("--allow", help="JSON file of accepted mismatches {step: [fields]}")
    args = ap.parse_args()
    log = run(args.base)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(log, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(log)} requests recorded -> {out}")
    if args.compare:
        before = json.loads(Path(args.compare).read_text())
        mismatches = compare(before, log)
        allowed = json.loads(Path(args.allow).read_text()) if args.allow else {}
        unexpected = [m for m in mismatches if m["field"] not in allowed.get(m["step"], {})]
        report = out.with_name(out.stem + "-diff.json")
        report.write_text(json.dumps({"compared": len(before), "mismatches": mismatches,
                                      "unexpected": unexpected}, indent=2, ensure_ascii=False) + "\n")
        print(f"compared {len(before)} requests: {len(mismatches)} mismatches "
              f"({len(mismatches) - len(unexpected)} accepted, {len(unexpected)} unexpected) -> {report}")
        sys.exit(1 if unexpected else 0)


if __name__ == "__main__":
    main()
