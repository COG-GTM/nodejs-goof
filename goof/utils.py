"""Misc helpers (port of utils.js)."""
import random
import string


def ran_no(min_value, max_value):
    return random.randint(min_value, max_value)


def uid(length):
    src = string.ascii_letters + string.digits
    return "".join(random.choice(src) for _ in range(length))


def forbidden():
    return "Forbidden", 403, {"Content-Type": "text/plain"}
