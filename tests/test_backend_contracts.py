from __future__ import annotations

import asyncio
import unittest

from fastapi import HTTPException

from backend.main import is_allowed_remote, nasa_tap, normalise_table, target_adql


class BackendContractTests(unittest.TestCase):
    def test_remote_allowlist_rejects_lookalikes_and_local_targets(self) -> None:
        self.assertTrue(is_allowed_remote("https://vizier.cds.unistra.fr/table.csv"))
        self.assertFalse(is_allowed_remote("https://vizier.cds.unistra.fr.evil.example/table.csv"))
        self.assertFalse(is_allowed_remote("http://127.0.0.1/private"))
        self.assertFalse(is_allowed_remote("file:///etc/passwd"))

    def test_target_adql_escapes_single_quotes(self) -> None:
        query = target_adql("Barnard's Star")
        self.assertIn("barnard''s star", query.lower())
        self.assertNotIn("barnard's star%'", query.lower())

    def test_public_tap_proxy_rejects_non_select_queries(self) -> None:
        with self.assertRaises(HTTPException) as context:
            asyncio.run(nasa_tap("delete from ps"))
        self.assertEqual(context.exception.status_code, 400)

    def test_table_normalisation_preserves_declared_uncertainty_and_instrument(self) -> None:
        parsed = normalise_table(
            "BJD,RV,RV_ERR,INSTRUMENT\n2450000,1.2,0.4,A\n2450001,1.8,0.5,A\n2450002,-0.2,0.6,B\n",
            instrument="FALLBACK",
        )
        self.assertEqual(parsed["n_rows"], 3)
        self.assertEqual(parsed["rows"][0]["err"], 0.4)
        self.assertEqual(parsed["rows"][2]["inst"], "B")


if __name__ == "__main__":
    unittest.main()
