from fastapi import HTTPException

from backend.main import (
    candidate_names,
    extract_urls_from_wget_script,
    is_allowed_remote,
    normalise_table,
    parse_votable_table,
)


def test_alias_candidates_include_short_51_peg_form():
    candidates = candidate_names("51 Pegasi b")
    assert "51 Peg b" in candidates
    assert "HD 217014" in candidates


def test_remote_import_boundary_rejects_private_hosts():
    assert is_allowed_remote("https://exoplanetarchive.ipac.caltech.edu/TAP/sync")
    assert is_allowed_remote("https://raw.githubusercontent.com/example/file.csv")
    assert not is_allowed_remote("http://127.0.0.1/private.csv")
    assert not is_allowed_remote("file:///tmp/rv.csv")
    assert not is_allowed_remote("https://example.invalid/table.csv")


def test_wget_url_extraction_keeps_allowlisted_https_sources():
    script = """
    wget http://exoplanetarchive.ipac.caltech.edu/data/example.csv
    wget https://example.invalid/not-allowed.csv
    """
    assert extract_urls_from_wget_script(script) == [
        "https://exoplanetarchive.ipac.caltech.edu/data/example.csv"
    ]


def test_normalise_csv_table_preserves_rows_and_instrument():
    table = """BJD,RV,RV_ERR,INSTRUMENT
2450000.0,1.1,0.4,HARPS
2450001.0,2.2,0.5,HARPS
2450002.0,1.5,0.6,ESPRESSO
"""
    result = normalise_table(table, instrument="REMOTE")
    assert result["n_rows"] == 3
    assert result["rejected_rows"] == 0
    assert result["mapping"]["time_col"] == "BJD"
    assert result["mapping"]["rv_col"] == "RV"
    assert result["rows"][2]["inst"] == "ESPRESSO"
    assert result["csv"].splitlines()[0] == "BJD,RV,RV_ERR,INSTRUMENT"


def test_normalise_csv_uses_fallback_instrument_and_error_floor():
    table = """time,velocity,error
1,3,0
2,4,-2
3,5,0.3
"""
    result = normalise_table(table, instrument="SYNTHETIC")
    assert [row["inst"] for row in result["rows"]] == ["SYNTHETIC"] * 3
    assert result["rows"][0]["err"] == 0.0001
    assert result["rows"][1]["err"] == 0.0001


def test_simple_votable_is_parsed():
    votable = """<?xml version='1.0'?>
<VOTABLE><RESOURCE><TABLE>
<FIELD name='BJD'/><FIELD name='RV'/>
<DATA><TABLEDATA>
<TR><TD>2450000</TD><TD>1.2</TD></TR>
<TR><TD>2450001</TD><TD>1.4</TD></TR>
</TABLEDATA></DATA>
</TABLE></RESOURCE></VOTABLE>
"""
    parsed = parse_votable_table(votable)
    assert parsed is not None
    assert parsed["columns"] == ["BJD", "RV"]
    assert parsed["rows_raw"][0] == ["2450000", "1.2"]
