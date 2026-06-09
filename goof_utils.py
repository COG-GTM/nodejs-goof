"""Small helpers, mirroring the original utils.js."""

import random

from flask import Response

_UID_SRC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"


def ran_no(min_value, max_value):
    return random.randint(min_value, max_value)


def uid(length):
    return "".join(random.choice(_UID_SRC) for _ in range(length))


def forbidden():
    body = "Forbidden"
    return Response(
        body,
        status=403,
        headers={
            "Content-Type": "text/plain",
            "Content-Length": str(len(body)),
        },
    )
