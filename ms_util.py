"""Minimal port of the ``ms`` / ``humanize-ms`` packages used for todo reminders.

Mirrors the original ReDoS-prone parsing: a single permissive regex matches a
number followed by an optional time unit, and ``format`` turns milliseconds back
into a short string.
"""

import re

_SECOND = 1000
_MINUTE = _SECOND * 60
_HOUR = _MINUTE * 60
_DAY = _HOUR * 24
_WEEK = _DAY * 7
_YEAR = _DAY * 365.25

_PARSE_RE = re.compile(
    r"^(-?(?:\d+)?\.?\d+) *"
    r"(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|"
    r"hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$",
    re.IGNORECASE,
)


def parse(value):
    """Parse a human string like ``"2 hours"`` into milliseconds."""
    if not isinstance(value, str) or not value:
        return None
    match = _PARSE_RE.match(value)
    if not match:
        return None
    n = float(match.group(1))
    unit = (match.group(2) or "ms").lower()
    if unit in ("years", "year", "yrs", "yr", "y"):
        return n * _YEAR
    if unit in ("weeks", "week", "w"):
        return n * _WEEK
    if unit in ("days", "day", "d"):
        return n * _DAY
    if unit in ("hours", "hour", "hrs", "hr", "h"):
        return n * _HOUR
    if unit in ("minutes", "minute", "mins", "min", "m"):
        return n * _MINUTE
    if unit in ("seconds", "second", "secs", "sec", "s"):
        return n * _SECOND
    return n


def format(ms_value):
    """Turn milliseconds back into a short string like ``"2h"``."""
    ms_value = abs(ms_value)
    if ms_value >= _DAY:
        return "%dd" % round(ms_value / _DAY)
    if ms_value >= _HOUR:
        return "%dh" % round(ms_value / _HOUR)
    if ms_value >= _MINUTE:
        return "%dm" % round(ms_value / _MINUTE)
    if ms_value >= _SECOND:
        return "%ds" % round(ms_value / _SECOND)
    return "%dms" % ms_value
