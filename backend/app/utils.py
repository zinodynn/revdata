from typing import Any

# Invisible/control characters often appearing in uploaded files
INVISIBLE_CHARS = ["\ufeff", "\u200b", "\u200e", "\u200f", "\u00a0"]


def _strip_invisible(s: str) -> str:
    """Remove common invisible/control characters and trim whitespace."""
    if not isinstance(s, str):
        return s
    out = s
    for c in INVISIBLE_CHARS:
        out = out.replace(c, "")
    # trim common leading/trailing whitespace after removal
    out = out.strip()
    return out


def normalize_json_keys(obj: Any) -> Any:
    """Recursively normalize dict keys and string values by removing common invisible characters.

    - For dicts: create a new dict with keys stripped of invisible chars and values normalized.
    - For lists/tuples: normalize each element.
    - For strings: remove invisible chars.
    - Other types: returned unchanged.
    """
    if isinstance(obj, dict):
        new = {}
        for k, v in obj.items():
            nk = k
            if isinstance(k, str):
                nk = _strip_invisible(k)
            new[nk] = normalize_json_keys(v)
        return new

    if isinstance(obj, list):
        return [normalize_json_keys(v) for v in obj]

    if isinstance(obj, tuple):
        return tuple(normalize_json_keys(v) for v in obj)

    if isinstance(obj, str):
        return _strip_invisible(obj)

    return obj
