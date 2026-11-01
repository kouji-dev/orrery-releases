# Self-check for ci-watch: what main.py sends matches the wire shapes (wire.rs),
# orrery.toml and ci.json. Stdlib only. Run from the ci-watch folder:
#   python -m unittest discover -s test
# The manifest checks need tomllib (Python 3.11+) and skip on older Pythons.

import io
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import main  # noqa: E402

try:
    import tomllib
except ImportError:  # Python < 3.11
    tomllib = None

PLACEMENTS = {"inline", "footer", "band", "pane.left", "pane.right", "hidden"}
RESERVED = {"esc", "ctrl+c", "ctrl+d", "enter", "tab"}  # orrery_proto::ui::RESERVED_KEYS


class Wire(unittest.TestCase):
    def test_a_frame_reads_back(self):
        msg = {"jsonrpc": "2.0", "id": 3, "method": "ui/status", "params": {"key": "ci", "text": "ci ✓ 12"}}
        self.assertEqual(main.read_message(io.BytesIO(main.frame(msg))), msg)

    def test_calls_have_the_required_fields(self):
        jobs = main.fetch_ci(0)["jobs"]
        for method, params in main.show_messages() + main.data_messages(0, jobs):
            if method == "ui/show":
                # UiShowParams: id, placement, and one of surface, component, structure.
                self.assertIn("id", params)
                self.assertIn(params["placement"], PLACEMENTS)
                self.assertEqual(sum(k in params for k in ("surface", "component", "structure")), 1)
                if "surface" in params:
                    self.assertIn("t", params["surface"]["kind"])
            elif method == "ui/data":
                # UiDataParams: id, and exactly one of set or patch.
                self.assertIn("id", params)
                self.assertEqual(sum(k in params for k in ("set", "patch")), 1)
            elif method == "ui/status":
                # UiStatusParams: key required, text optional.
                self.assertIn("key", params)
                self.assertIsInstance(params["text"], str)
            else:
                self.fail("unexpected method " + method)

    def test_the_counts_follow_the_jobs(self):
        data = main.panel(main.fetch_ci(0)["jobs"])
        self.assertEqual((data["failed"], data["total"], data["status"]), (1, 3, "failed"))

    def test_a_rerun_marks_the_job_and_redraws(self):
        jobs = main.fetch_ci(0)["jobs"]
        sent = main.event_messages({"id": "ci", "action": "rerun", "value": "test"}, jobs)
        self.assertEqual(sent[0][0], "ui/data")
        data = sent[0][1]["set"]
        self.assertEqual([j["status"] for j in data["jobs"] if j["name"] == "test"], ["rerunning"])
        self.assertEqual(data["failed"], 0)

    def test_explain_asks_the_agent_and_other_events_do_nothing(self):
        jobs = main.fetch_ci(0)["jobs"]
        self.assertEqual(main.event_messages({"id": "ci", "action": "explain", "value": None}, jobs)[0][0], "run/send")
        self.assertEqual(main.event_messages({"id": "other", "action": "rerun", "value": "test"}, jobs), [])
        self.assertEqual(main.event_messages({"id": "ci", "action": "rerun", "value": None}, jobs), [])

    def test_the_structure_names_only_handled_actions(self):
        with open(os.path.join(ROOT, "ci.json"), encoding="utf-8") as f:
            text = f.read()
        self.assertIn('"action": "rerun"', text)
        self.assertIn('"action": "explain"', text)

    def test_outcomes_are_ok_or_failed(self):
        self.assertEqual(main.call_reply("refresh", 0)["outcome"]["t"], "ok")
        self.assertEqual(main.call_reply("nope", 0)["outcome"]["t"], "failed")

    def test_the_timer_is_armed_in_milliseconds(self):
        self.assertEqual(main.REFRESH_MS, 30_000)


@unittest.skipIf(tomllib is None, "tomllib needs Python 3.11+")
class Manifest(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(ROOT, "orrery.toml"), "rb") as f:
            self.manifest = tomllib.load(f)

    def test_the_placements_are_the_ones_the_code_fills(self):
        declared = {p["id"]: p for p in self.manifest["provides"]["placements"]}
        self.assertEqual(set(declared), {"ci", "deploy"})
        self.assertEqual(declared["ci"]["placement"], "pane.right")
        self.assertEqual(declared["deploy"]["placement"], "band")
        jobs = main.fetch_ci(0)["jobs"]
        calls = main.show_messages() + main.data_messages(0, jobs)
        shown = {params["id"]: params for m, params in calls if m == "ui/show"}
        for pid, params in shown.items():
            self.assertEqual(params["placement"], declared[pid]["placement"])
            self.assertEqual(params["title"], declared[pid]["title"])

    def test_the_key_runs_the_command_the_tool_declares(self):
        keys = self.manifest["provides"]["keys"]
        self.assertEqual(len(keys), 1)
        self.assertNotIn(keys[0]["key"], RESERVED)
        commands = {t["command"] for t in main.load_reply()["tools"]}
        self.assertEqual(keys[0]["command"], "ci refresh")
        self.assertIn(keys[0]["command"], commands)

    def test_the_pane_shows_the_declared_component(self):
        names = [c["name"] for c in self.manifest["provides"]["components"]]
        self.assertEqual(names, ["ci"])
        self.assertEqual(self.manifest["provides"]["components"][0]["file"], "ci.json")
        self.assertEqual(main.show_messages()[0][1]["component"], "ci")

    def test_the_tool_is_listed_and_the_extension_is_resident(self):
        self.assertEqual(self.manifest["provides"]["tools"], [t["name"] for t in main.load_reply()["tools"]])
        self.assertTrue(self.manifest["extension"]["resident"])


if __name__ == "__main__":
    unittest.main()
