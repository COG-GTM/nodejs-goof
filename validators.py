"""Small subset of the ``validator`` npm package used by the app."""

import re

_EMAIL_RE = re.compile(
    r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}"
    r"[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)
_DISPLAY_NAME_RE = re.compile(r"^\s*(.+?)\s*<(.+)>\s*$")
_IL_MOBILE_RE = re.compile(r"^(\+972|0)([23489]|5[0-9]|77)[1-9]\d{6}$")


def is_email(value, allow_display_name=False):
    if not isinstance(value, str):
        return False
    if allow_display_name:
        match = _DISPLAY_NAME_RE.match(value)
        if match:
            value = match.group(2)
    return bool(_EMAIL_RE.match(value))


def is_mobile_phone(value, locale="he-IL"):
    if not isinstance(value, str):
        return False
    return bool(_IL_MOBILE_RE.match(value))


def is_ascii(value):
    if not isinstance(value, str):
        return False
    return all(ord(ch) < 128 for ch in value)


def rtrim(value):
    if not isinstance(value, str):
        return value
    return value.rstrip()
