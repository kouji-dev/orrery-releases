# CI watch: a resident extension that draws CI status in the TUI (plan 41 W4.2,
# plan 42 W5.2). Its `ci` pane is the catalog component declared in orrery.toml
# (`ci.json`): shown once with `ui/show {component}`, then fed with `ui/data`;
# a chosen job comes back as `ui/event` and is rerun.
#
# Raw JSON-RPC 2.0 over stdio with Content-Length framing, the wire the Rust and
# Node SDKs speak (`orrery-jsonrpc` framing::content_length). Stdlib only.
# Method names and shapes: `harness/protocol/context-api.json` and
# `orrery-ext-api` wire.rs.

import json
import sys

REFRESH_MS = 30_000  # how often the timer redraws
TAG = "refresh"  # the timer's tag, and the tool's name
JOBS = ["lint", "test", "build"]
METHOD_NOT_FOUND = -32601
INTERNAL = -32603


def fetch_ci(tick):
    """Fake CI results for refresh `tick`, deterministic, no network.

    Real polling goes here: GET the workflow runs for the branch and map them to
    this shape (the component's data, see the schema in orrery.toml). It runs on
    the timer and in the refresh tool, never on a draw.
    shortcut: fake data. Upgrade: a CI API client here, with a timeout.
    """
    return {
        "workflow": "build",
        "jobs": [{"name": n, "status": "failed" if n == "test" else "passed"} for n in JOBS],
        "deploy_done": (tick * 3) % 11,
        "deploy_total": 10,
    }


def panel(jobs):
    """The `ci` component's data for `jobs`: the counts follow the jobs."""
    failed = sum(1 for j in jobs if j["status"] == "failed")
    return {
        "workflow": "build",
        "status": "failed" if failed else "passed",
        "failed": failed,
        "total": len(jobs),
        "jobs": jobs,
    }


def show_messages():
    """The `ui/show` calls that place everything, as (method, params). The pane
    starts from its schema's defaults; `data_messages` fills it."""
    return [
        ("ui/show", {"id": "ci", "placement": "pane.right", "component": "ci", "data": {}, "title": "CI"}),
    ]


def data_messages(tick, jobs):
    """The calls that redraw from fresh results: the pane's data, the deploy
    band and the status segment."""
    ci = fetch_ci(tick)
    deploy = {
        "kind": {
            "t": "progress",
            "label": "deploy web %d/%d" % (ci["deploy_done"], ci["deploy_total"]),
            "done": ci["deploy_done"],
            "total": ci["deploy_total"],
        }
    }
    data = panel(jobs)
    passed = data["total"] - data["failed"]
    return [
        ("ui/data", {"id": "ci", "set": data}),
        ("ui/show", {"id": "deploy", "placement": "band", "surface": deploy, "title": "Deploy"}),
        ("ui/status", {"key": "ci", "text": "ci ✓ %d" % passed}),
    ]


def event_messages(params, jobs):
    """What a `ui/event` on the pane does, as (method, params): `rerun` marks the
    chosen job rerunning (a real rerun would start it here), `explain` asks the
    agent, as the extension's own message."""
    if params.get("id") != "ci":
        return []
    action, value = params.get("action"), params.get("value")
    if action == "rerun" and isinstance(value, str):
        for job in jobs:
            if job["name"] == value:
                job["status"] = "rerunning"
        return [
            ("ui/data", {"id": "ci", "set": panel(jobs)}),
            ("ui/status", {"key": "ci", "text": "ci ↻ %s" % value}),
        ]
    if action == "explain":
        return [("run/send", {"input": {"text": "Explain why CI failed"}})]
    return []


def load_reply():
    """What `ext/load` answers: the tool, and its command (`/ci refresh`)."""
    return {
        "tools": [
            {
                "name": TAG,
                "description": "Re-read the CI status and redraw the CI pane.",
                "input_schema": {"type": "object", "properties": {}},
                "command": "ci refresh",
            }
        ],
        "problems": [],
    }


def call_reply(tool, tick):
    """What `tool/call` answers: an Outcome (`ok` or `failed`)."""
    if tool != TAG:
        return {"outcome": {"t": "failed", "code": "no-such-tool", "message": "no tool `%s`" % tool}}
    ci = fetch_ci(tick)
    data = panel(ci["jobs"])
    text = "CI: %d passing, %d failed" % (data["total"] - data["failed"], data["failed"])
    return {"outcome": {"t": "ok", "surface": {"kind": {"t": "text", "value": text}}}}


def frame(message):
    body = json.dumps(message).encode("utf-8")
    return b"Content-Length: %d\r\n\r\n" % len(body) + body


def read_message(stream):
    """One framed message from `stream`, or None at a clean end of stream."""
    length = None
    while True:
        line = stream.readline()
        if not line:
            return None
        line = line.strip()
        if not line:
            break
        name, _, value = line.partition(b":")
        if name.strip().lower() == b"content-length":
            length = int(value.strip())
    if length is None:
        raise ValueError("a message arrived with no Content-Length header")
    return json.loads(stream.read(length).decode("utf-8"))


class Extension:
    def __init__(self, out):
        self.out = out
        self.tick = 0
        self.jobs = fetch_ci(0)["jobs"]
        self.next_id = 1
        self.pending = {}  # our request id -> method, to name a refusal

    def send(self, message):
        self.out.write(frame(message))
        self.out.flush()

    def reply(self, ident, result):
        self.send({"jsonrpc": "2.0", "id": ident, "result": result})

    def reply_error(self, ident, code, message):
        self.send({"jsonrpc": "2.0", "id": ident, "error": {"code": code, "message": message}})

    def request(self, method, params):
        ident = self.next_id
        self.next_id += 1
        self.pending[ident] = method
        self.send({"jsonrpc": "2.0", "id": ident, "method": method, "params": params})

    def send_all(self, messages):
        for method, params in messages:
            self.request(method, params)

    def refresh(self):
        """Fresh results: the jobs are re-read, then everything redraws."""
        self.jobs = fetch_ci(self.tick)["jobs"]
        self.send_all(data_messages(self.tick, self.jobs))

    def arm_timer(self):
        self.request("timer/set", {"after_ms": REFRESH_MS, "tag": TAG})

    def dispatch(self, msg):
        method = msg.get("method")
        ident = msg.get("id")
        if method is None:
            # The answer to one of our requests. A refusal is named on stderr, never silent.
            asked = self.pending.pop(ident, None)
            if asked is not None and "error" in msg:
                sys.stderr.write("ci-watch: the host refused %s: %s\n" % (asked, json.dumps(msg["error"])))
            return
        params = msg.get("params") or {}
        if ident is None:
            # A notification from the host.
            if method == "timer/fired" and params.get("tag") == TAG:
                self.tick += 1
                self.refresh()
                self.arm_timer()
            elif method == "ui/event":
                self.send_all(event_messages(params, self.jobs))
            return
        if method == "ext/load":
            self.reply(ident, load_reply())
            self.send_all(show_messages())
            self.refresh()
            self.arm_timer()
        elif method == "tool/call":
            if params.get("tool") == TAG:
                self.tick += 1
                self.refresh()
            self.reply(ident, call_reply(params.get("tool"), self.tick))
        elif method == "ext/shutdown":
            self.reply(ident, {})
            raise SystemExit(0)
        else:
            self.reply_error(ident, METHOD_NOT_FOUND, "ci-watch does not handle %s" % method)


def main():
    ext = Extension(sys.stdout.buffer)
    while True:
        msg = read_message(sys.stdin.buffer)
        if msg is None:  # the host closed the pipe
            return
        try:
            ext.dispatch(msg)
        except Exception as e:  # answer the call that failed; the process lives on
            if msg.get("id") is not None and "method" in msg:
                ext.reply_error(msg["id"], INTERNAL, str(e))
            sys.stderr.write("ci-watch: %s failed: %s\n" % (msg.get("method"), e))


if __name__ == "__main__":
    main()
