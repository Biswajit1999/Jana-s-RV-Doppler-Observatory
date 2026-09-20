from __future__ import annotations

import json
import unittest
from pathlib import Path

from scripts.audit_rv_library import CSV_PATH, INDEX_PATH, JSON_PATH, SVG_PATH, build_audit, csv_text, maturity_svg

ROOT = Path(__file__).resolve().parents[1]


class RVLibraryAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.audit = build_audit()

    def test_full_bundle_is_audited(self) -> None:
        index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        self.assertEqual(self.audit["audited_files"], 250)
        self.assertEqual(self.audit["index_targets"], len(index))
        self.assertEqual(self.audit["total_rows"], 154_150)
        self.assertEqual(len(self.audit["records"]), 250)

    def test_preregistered_headline_is_stable(self) -> None:
        summary = self.audit["summary"]
        self.assertEqual(summary["inference_ready_files"], 39)
        self.assertEqual(summary["files_with_repeated_epochs"], 158)
        self.assertEqual(summary["files_with_confounded_reference_offsets"], 181)
        self.assertEqual(summary["files_with_extreme_range_ratio"], 44)
        self.assertEqual(summary["repeated_epoch_rows"], 34_153)
        self.assertEqual(summary["conflicting_epoch_rows"], 34_153)

    def test_numerical_parsing_contracts_hold(self) -> None:
        summary = self.audit["summary"]
        self.assertEqual(summary["invalid_numeric_rows"], 0)
        self.assertEqual(summary["nonpositive_error_rows"], 0)
        self.assertEqual(summary["exact_duplicate_rows"], 0)
        self.assertRegex(self.audit["bundle_sha256"], r"^[a-f0-9]{64}$")

    def test_generated_products_are_current(self) -> None:
        expected_json = json.dumps(self.audit, indent=2, ensure_ascii=False) + "\n"
        self.assertEqual(JSON_PATH.read_text(encoding="utf-8"), expected_json)
        self.assertEqual(CSV_PATH.read_text(encoding="utf-8"), csv_text(self.audit))
        self.assertEqual(SVG_PATH.read_text(encoding="utf-8"), maturity_svg())


if __name__ == "__main__":
    unittest.main()

