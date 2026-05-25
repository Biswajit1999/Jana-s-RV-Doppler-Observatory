from __future__ import annotations

import csv
import io
import os
import re
from typing import Any
from urllib.parse import quote_plus, urlparse

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

NASA_TAP_SYNC = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
NASA_RADIAL_WGET = "https://exoplanetarchive.ipac.caltech.edu/bulk_data_download/wget_RADIAL.bat"

app = FastAPI(title="Jana RV Doppler Observatory API", version="0.4.1")

origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000,http://127.0.0.1:8010,https://biswajit1999.github.io",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

SELECT_COLUMNS = """
    pl_name, hostname, discoverymethod, disc_year,
    ra, dec, sy_dist, st_spectype, sy_vmag,
    pl_orbper, pl_rvamp, pl_orbeccen, pl_bmassj, pl_orbsmax,
    default_flag
"""

ALIASES: dict[str, list[str]] = {
    "51 pegasi b": ["51 Peg b", "51 Peg", "HD 217014"],
    "51 peg b": ["51 Peg b", "51 Peg", "HD 217014"],
    "hd 217014 b": ["51 Peg b", "51 Peg", "HD 217014"],
    "hd 189733 b": ["HD 189733 b", "HD 189733"],
    "proxima centauri b": ["Proxima Cen b", "Proxima Cen", "Proxima Centauri"],
    "proxima cen b": ["Proxima Cen b", "Proxima Cen", "Proxima Centauri"],
    "barnard b": ["Barnard b", "Barnard's Star", "Barnard Star"],
    "tau ceti": ["tau Cet", "tau Ceti", "HD 10700"],
}

ALLOWED_REMOTE_HOSTS = {
    "exoplanetarchive.ipac.caltech.edu",
    "raw.githubusercontent.com",
    "githubusercontent.com",
    "cdsarc.cds.unistra.fr",
    "vizier.cds.unistra.fr",
    "dace.unige.ch",
}


def clean_name(name: str) -> str:
    cleaned = " ".join(name.strip().split())
    if not cleaned or len(cleaned) > 120:
        raise HTTPException(status_code=400, detail="Invalid target name")
    return cleaned


def adql_escape(value: str) -> str:
    return value.replace("'", "''")


def normalise_key(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"\s+", " ", value)
    return value


def compact_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def candidate_names(name: str) -> list[str]:
    cleaned = clean_name(name)
    key = normalise_key(cleaned)
    candidates: list[str] = [cleaned]
    if key in ALIASES:
        candidates.extend(ALIASES[key])
    bits = cleaned.split()
    if len(bits) > 2 and len(bits[-1]) == 1 and bits[-1].isalpha():
        candidates.append(" ".join(bits[:-1]))
    if "pegasi" in key:
        candidates.append(re.sub("pegasi", "Peg", cleaned, flags=re.IGNORECASE))
        candidates.append(re.sub("pegasi b", "Peg b", cleaned, flags=re.IGNORECASE))
    seen: set[str] = set()
    unique: list[str] = []
    for item in candidates:
        n = " ".join(str(item).split())
        k = normalise_key(n)
        if n and k not in seen:
            seen.add(k)
            unique.append(n)
    return unique


def target_adql(name: str) -> str:
    clauses: list[str] = []
    for cand in candidate_names(name):
        q = adql_escape(cand.lower())
        clauses.append(f"lower(pl_name) like '%{q}%'")
        clauses.append(f"lower(hostname) like '%{q}%'")
    where = " or\n              ".join(clauses)
    return f"""
        select top 10
            {SELECT_COLUMNS}
        from ps
        where default_flag = 1
          and (
              {where}
          )
        order by pl_name
    """


async def fetch_json(url: str, params: dict[str, Any], timeout: float = 25.0) -> Any:
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(url, params=params)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text[:500])
    return response.json()


def is_allowed_remote(url: str) -> bool:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    return parsed.scheme in {"http", "https"} and any(host == h or host.endswith("." + h) for h in ALLOWED_REMOTE_HOSTS)


async def fetch_text(url: str, timeout: float = 35.0, max_bytes: int = 6_000_000) -> str:
    if not is_allowed_remote(url):
        raise HTTPException(status_code=400, detail="URL host is not in the allowed astronomy source list")
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(url)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text[:500])
    content = response.content[:max_bytes]
    return content.decode(response.encoding or "utf-8", errors="replace")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "jana-rv-api", "version": "0.4.1"}


@app.get("/api/nasa-tap")
async def nasa_tap(query: str = Query(..., min_length=8, max_length=8000)) -> Any:
    return await fetch_json(NASA_TAP_SYNC, {"query": query, "format": "json"})


@app.get("/api/target")
async def target(name: str = Query(..., min_length=1, max_length=120)) -> dict[str, Any]:
    adql = target_adql(name)
    rows = await fetch_json(NASA_TAP_SYNC, {"query": adql, "format": "json"})
    planet = rows[0] if isinstance(rows, list) and rows else {}
    simbad_name = planet.get("hostname") or candidate_names(name)[0]
    display_name = planet.get("pl_name") or candidate_names(name)[0]
    return {
        "source": "NASA Exoplanet Archive TAP via Jana FastAPI proxy",
        "query": adql,
        "input_name": name,
        "candidate_names": candidate_names(name),
        "planet": planet,
        "nasa_rows": rows if isinstance(rows, list) else [],
        "links": archive_links(display_name, simbad_name),
    }


def archive_links(display_name: str, host_name: str) -> dict[str, str]:
    return {
        "nasa_overview": f"https://exoplanetarchive.ipac.caltech.edu/overview/{quote_plus(display_name)}",
        "nasa_rv_resources": "https://exoplanetarchive.ipac.caltech.edu/docs/rv.html",
        "nasa_radial_wget": NASA_RADIAL_WGET,
        "simbad": f"https://simbad.cds.unistra.fr/simbad/sim-id?Ident={quote_plus(host_name)}",
        "vizier": f"https://vizier.cds.unistra.fr/viz-bin/VizieR?-c={quote_plus(host_name)}&-c.rs=5",
        "gaia": "https://gea.esac.esa.int/archive/",
        "mast": "https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html",
        "dace": "https://dace.unige.ch/exoplanets/",
    }


def source_record(source: str, kind: str, title: str, url: str, status: str, importable: bool, notes: str) -> dict[str, Any]:
    return {"source": source, "kind": kind, "title": title, "url": url, "status": status, "importable": importable, "notes": notes}


def extract_urls_from_wget_script(script: str) -> list[str]:
    urls = re.findall(r"https?://[^\s'\"<>]+", script)
    cleaned: list[str] = []
    for url in urls:
        url = url.rstrip(";,)\r\n")
        if url.startswith("http://exoplanetarchive.ipac.caltech.edu"):
            url = url.replace("http://", "https://", 1)
        if is_allowed_remote(url):
            cleaned.append(url)
    return sorted(set(cleaned))


@app.get("/api/rv-sources")
async def rv_sources(name: str = Query(..., min_length=1, max_length=120)) -> dict[str, Any]:
    names = candidate_names(name)
    host_guess = names[0]
    target_rows: list[dict[str, Any]] = []
    try:
        rows = await fetch_json(NASA_TAP_SYNC, {"query": target_adql(name), "format": "json"})
        target_rows = rows if isinstance(rows, list) else []
        if target_rows:
            host_guess = target_rows[0].get("hostname") or host_guess
            if target_rows[0].get("pl_name"):
                names.append(target_rows[0]["pl_name"])
            if target_rows[0].get("hostname"):
                names.append(target_rows[0]["hostname"])
    except Exception:
        target_rows = []

    compact_candidates = {compact_key(n) for n in names if n}
    sources: list[dict[str, Any]] = []

    try:
        script = await fetch_text(NASA_RADIAL_WGET, max_bytes=12_000_000)
        urls = extract_urls_from_wget_script(script)
        matches = []
        for url in urls:
            ck = compact_key(url)
            if any(c and c in ck for c in compact_candidates):
                matches.append(url)
        for url in matches[:30]:
            sources.append(source_record(
                "NASA Exoplanet Archive", "radial-velocity file", url.rsplit("/", 1)[-1], url,
                "candidate match", True, "Matched against the NASA RADIAL bulk wget script."
            ))
        script_status = f"scanned {len(urls)} RADIAL bulk URLs; {len(matches)} candidate match(es)"
    except Exception as exc:
        script_status = f"could not scan RADIAL wget script: {exc}"

    links = archive_links(names[0], host_guess)
    sources.extend([
        source_record("NASA Exoplanet Archive", "overview", "Planet host overview / associated time series", links["nasa_overview"], "manual source", False, "Open the overview page and enable Associated Data → Time Series if needed."),
        source_record("NASA Exoplanet Archive", "bulk index", "RADIAL bulk wget script", links["nasa_radial_wget"], script_status, False, "Backend scans this file for direct URLs; manual use is also possible."),
        source_record("CDS VizieR", "catalogue search", "VizieR cone/name search", links["vizier"], "manual source", False, "Useful for paper tables and machine-readable literature catalogues."),
        source_record("CDS SIMBAD", "identity/bibliography", "SIMBAD object page", links["simbad"], "metadata source", False, "Use references/identifiers to trace original RV publications."),
        source_record("DACE", "RV ecosystem", "DACE exoplanets portal", links["dace"], "manual source", False, "DACE is valuable for RV workflows, but automated access needs a dedicated adapter/permission check."),
        source_record("MAST", "photometry", "MAST portal", links["mast"], "photometry source", False, "Use for TESS/Kepler photometry rather than RV tables."),
    ])

    return {"target": name, "candidate_names": names, "planet_rows": target_rows, "sources": sources}


def parse_remote_rv_table(text: str, instrument: str) -> dict[str, Any]:
    raw_lines = [ln.strip() for ln in text.splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
    if not raw_lines:
        raise HTTPException(status_code=422, detail="Remote file has no parseable data rows")
    header_tokens: list[str] | None = None
    data_start = 0
    for idx, line in enumerate(raw_lines[:30]):
        if re.search(r"[A-Za-z]", line):
            header_tokens = re.split(r"[,;\t\s]+", line.strip())
            data_start = idx + 1
            break
    data_lines = raw_lines[data_start:]
    if not data_lines:
        raise HTTPException(status_code=422, detail="Remote file contains a header but no data rows")
    delimiter = None
    sample = "\n".join(data_lines[:10])
    if "," in sample:
        delimiter = ","
    elif ";" in sample:
        delimiter = ";"
    elif "\t" in sample:
        delimiter = "\t"
    rows_raw: list[list[str]] = []
    if delimiter:
        reader = csv.reader(io.StringIO("\n".join(data_lines)), delimiter=delimiter)
        rows_raw = [[c.strip() for c in row] for row in reader if row]
    else:
        rows_raw = [re.split(r"\s+", ln.strip()) for ln in data_lines]
    headers = [h.lower().strip() for h in (header_tokens or [])]

    def find_index(options: list[str], default: int | None = None) -> int | None:
        for opt in options:
            if opt in headers:
                return headers.index(opt)
        for i, h in enumerate(headers):
            if any(opt in h for opt in options):
                return i
        return default

    time_i = find_index(["bjd", "bjd_tdb", "jd", "hjd", "time", "mjd"], 0)
    rv_i = find_index(["rv", "vrad", "radvel", "velocity", "mnvel"], 1)
    err_i = find_index(["rv_err", "rverr", "e_rv", "err", "error", "sigma"], 2 if rows_raw and len(rows_raw[0]) > 2 else None)
    inst_i = find_index(["instrument", "inst", "telescope", "facility"], None)
    if time_i is None or rv_i is None:
        raise HTTPException(status_code=422, detail="Could not identify time and RV columns")
    rows: list[dict[str, Any]] = []
    for row in rows_raw:
        try:
            t = float(row[time_i])
            rv = float(row[rv_i])
            err = float(row[err_i]) if err_i is not None and err_i < len(row) else 1.0
            inst = row[inst_i] if inst_i is not None and inst_i < len(row) and row[inst_i] else instrument
            rows.append({"t": t, "rv": rv, "err": max(err, 0.0001), "inst": inst})
        except Exception:
            continue
    if len(rows) < 3:
        raise HTTPException(status_code=422, detail="Fewer than 3 usable RV rows after parsing")
    csv_lines = ["BJD,RV,RV_ERR,INSTRUMENT"]
    csv_lines.extend(f"{r['t']},{r['rv']},{r['err']},{r['inst']}" for r in rows)
    return {"rows": rows, "csv": "\n".join(csv_lines), "columns": ["BJD", "RV", "RV_ERR", "INSTRUMENT"], "n_rows": len(rows)}


@app.get("/api/import-rv-url")
async def import_rv_url(url: str = Query(..., min_length=10, max_length=2000), instrument: str = "REMOTE") -> dict[str, Any]:
    text = await fetch_text(url)
    parsed = parse_remote_rv_table(text, instrument=instrument)
    parsed["source_url"] = url
    parsed["source"] = "remote machine-readable RV table"
    return parsed
