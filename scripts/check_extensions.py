#!/usr/bin/env python3
"""Check extensions.json: the shape `orrery install` and the gallery read.

    python3 scripts/check_extensions.py [extensions.json]

Standard library only. Prints every problem and exits 1 when there is one.
"""
import json
import re
import sys

REQUIRED = ("id", "name", "description", "author", "source", "repository", "version")
OPTIONAL = ("keywords", "capabilities")
ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$")
# What `orrery install` takes: npm, crates.io, or a git URL / host shorthand.
SOURCE = re.compile(r"^(npm:.+|crate:.+|crates-io:.+|github:.+/.+|gitlab:.+/.+|https://.+|ssh://.+|git://.+|git@.+:.+)$")


def check(doc):
    problems = []
    if not isinstance(doc, dict):
        return ["the top level must be an object: {\"schema\": 1, \"extensions\": [...]}"]
    if doc.get("schema") != 1:
        problems.append(f"`schema` must be 1, found {doc.get('schema')!r}")
    extra = set(doc) - {"schema", "extensions"}
    if extra:
        problems.append(f"unknown top-level keys: {sorted(extra)}")
    entries = doc.get("extensions")
    if not isinstance(entries, list):
        return problems + ["`extensions` must be an array"]
    seen = {}
    for i, e in enumerate(entries):
        where = f"extensions[{i}]"
        if not isinstance(e, dict):
            problems.append(f"{where}: must be an object")
            continue
        where = f"extensions[{i}] ({e.get('id', '?')})"
        for key in REQUIRED:
            if not isinstance(e.get(key), str) or not e[key].strip():
                problems.append(f"{where}: `{key}` is required, a non-empty string")
        for key in OPTIONAL:
            if key in e and not (isinstance(e[key], list) and all(isinstance(x, str) and x for x in e[key])):
                problems.append(f"{where}: `{key}` must be an array of non-empty strings")
        extra = set(e) - set(REQUIRED) - set(OPTIONAL)
        if extra:
            problems.append(f"{where}: unknown keys {sorted(extra)} (allowed: {', '.join(REQUIRED + OPTIONAL)})")
        eid = e.get("id")
        if isinstance(eid, str):
            if not ID.match(eid):
                problems.append(f"{where}: `id` must be lowercase letters, digits and `-`")
            if eid in seen:
                problems.append(f"{where}: `id` {eid!r} is already used by extensions[{seen[eid]}]")
            seen.setdefault(eid, i)
        source = e.get("source")
        if isinstance(source, str) and not SOURCE.match(source):
            problems.append(f"{where}: `source` must be `npm:<pkg>`, `crate:<name>` or a git URL, found {source!r}")
        version = e.get("version")
        if isinstance(version, str) and isinstance(source, str) and source.startswith(("npm:", "crate:", "crates-io:")) \
                and not SEMVER.match(version):
            problems.append(f"{where}: `version` must be an exact semver version (1.2.0) for an npm or crates.io source")
        repo = e.get("repository")
        if isinstance(repo, str) and not repo.startswith("https://"):
            problems.append(f"{where}: `repository` must be an https:// URL")
    return problems


def self_test():
    good = {"schema": 1, "extensions": [{"id": "a", "name": "A", "description": "d", "author": "x",
                                         "source": "npm:a", "repository": "https://github.com/x/a",
                                         "version": "1.0.0", "keywords": ["k"]}]}
    assert check(good) == [], check(good)
    assert check({"schema": 1, "extensions": []}) == []
    dup = {"schema": 1, "extensions": good["extensions"] * 2}
    assert any("already used" in p for p in check(dup))
    missing = {"schema": 1, "extensions": [{"id": "a"}]}
    assert any("`name` is required" in p for p in check(missing))
    bad = dict(good["extensions"][0], source="pypi:a", version="latest")
    assert any("`source`" in p for p in check({"schema": 1, "extensions": [bad]}))


def main(path):
    self_test()
    try:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
    except (OSError, json.JSONDecodeError) as error:
        print(f"{path}: not valid JSON: {error}")
        return 1
    problems = check(doc)
    for p in problems:
        print(f"{path}: {p}")
    if not problems:
        print(f"{path}: ok, {len(doc['extensions'])} extension(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "extensions.json"))
