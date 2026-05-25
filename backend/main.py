from __future__ import annotations

import csv
import io
import json
import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote_plus, urlparse

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

NASA_TAP_SYNC = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
NASA_RADIAL_WGET = "https://exoplanetarchive.ipac.caltech.edu/bulk_data_download/wget_RADIAL.bat"
CACHE_DIR = Path(__file__).resolve().parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)
TARGET_CACHE = CACHE_DIR / "targets_snapshot.json"
RV_SOURCE_CACHE = CACHE_DIR / "rv_source_index.json"

app = FastAPI(title="Jana RV Doppler Observatory API", version="0.6.0")

origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000,http://127.0.0.1:8010,https://biswajit1999.github.io",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_methods=["GET", "POST", "OPTIONS"],
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
    "archive.stsci.edu",
    "mast.stsci.edu",
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


def snapshot_adql(limit: int = 5000) -> str:
    return f"""
        select top {int(limit)}
            {SELECT_COLUMNS}
        from ps
        where default_flag = 1
        order by hostname, pl_name
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


async def fetch_text(url: str, timeout: float = 45.0, max_bytes: int = 12_000_000) -> str:
    if not is_allowed_remote(url):
        raise HTTPException(status_code=400, detail="URL host is not in the allowed astronomy source list")
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(url)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text[:500])
    content = response.content[:max_bytes]
    return content.decode(response.encoding or "utf-8", errors="replace")


def load_json_file(path: Path, default: Any) -> Any:
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default


def write_json_file(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "jana-rv-api", "version": "0.6.0"}


@app.get("/api/adapters")
async def adapters() -> dict[str, Any]:
    return {
        "version": "0.6.0",
        "adapters": [
            {"id": "nasa-tap", "name": "NASA Exoplanet Archive TAP", "status": "live", "capabilities": ["target metadata", "ADQL"]},
            {"id": "offline-cache", "name": "Local offline target snapshot", "status": "live", "capabilities": ["build cache", "search offline", "use without archive calls after caching"]},
            {"id": "remote-table", "name": "Universal machine-readable table importer", "status": "live", "capabilities": ["CSV", "TSV", "TXT", "DAT", "XML/VOTable preview", "column map"]},
            {"id": "nasa-radial", "name": "NASA RADIAL contributed time-series", "status": "experimental", "capabilities": ["bulk script scan", "direct file import when URLs are exposed"]},
            {"id": "vizier", "name": "CDS VizieR", "status": "link + URL import", "capabilities": ["catalogue routing", "manual machine-readable table URL import"]},
            {"id": "dace", "name": "DACE", "status": "link + future adapter", "capabilities": ["manual portal routing", "future authenticated/API adapter"]},
        ],
    }


@app.get("/api/nasa-tap")
async def nasa_tap(query: str = Query(..., min_length=8, max_length=8000)) -> Any:
    return await fetch_json(NASA_TAP_SYNC, {"query": query, "format": "json"})


@app.get("/api/target")
async def target(name: str = Query(..., min_length=1, max_length=120), offline: bool = False) -> dict[str, Any]:
    if offline:
        cached = search_cache_rows(name, limit=10)
        planet = cached[0] if cached else {}
        display = planet.get("pl_name") or candidate_names(name)[0]
        host = planet.get("hostname") or display
        return {
            "source": "local offline cache",
            "input_name": name,
            "candidate_names": candidate_names(name),
            "planet": planet,
            "nasa_rows": cached,
            "links": archive_links(display, host),
        }

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


@app.post("/api/cache/build")
async def build_cache(limit: int = Query(5000, ge=10, le=20000)) -> dict[str, Any]:
    rows = await fetch_json(NASA_TAP_SYNC, {"query": snapshot_adql(limit), "format": "json"}, timeout=60.0)
    if not isinstance(rows, list):
        raise HTTPException(status_code=502, detail="NASA TAP did not return a list")
    payload = {"source": "NASA Exoplanet Archive ps table", "limit": limit, "n_rows": len(rows), "rows": rows}
    write_json_file(TARGET_CACHE, payload)
    return {"status": "ok", "cache_file": str(TARGET_CACHE), "n_rows": len(rows)}


@app.get("/api/cache/status")
async def cache_status() -> dict[str, Any]:
    target_cache = load_json_file(TARGET_CACHE, None)
    rv_cache = load_json_file(RV_SOURCE_CACHE, None)
    return {
        "target_cache_exists": TARGET_CACHE.exists(),
        "target_cache_rows": target_cache.get("n_rows", 0) if isinstance(target_cache, dict) else 0,
        "target_cache_file": str(TARGET_CACHE),
        "rv_source_cache_exists": RV_SOURCE_CACHE.exists(),
        "rv_source_cache_urls": rv_cache.get("n_urls", 0) if isinstance(rv_cache, dict) else 0,
        "rv_source_cache_file": str(RV_SOURCE_CACHE),
    }


def search_cache_rows(q: str, limit: int = 50) -> list[dict[str, Any]]:
    payload = load_json_file(TARGET_CACHE, {"rows": []})
    rows = payload.get("rows", []) if isinstance(payload, dict) else []
    terms = [compact_key(x) for x in candidate_names(q)]
    out: list[dict[str, Any]] = []
    for row in rows:
        hay = compact_key(" ".join(str(row.get(k, "")) for k in ["pl_name", "hostname", "st_spectype"]))
        if any(t and t in hay for t in terms):
            out.append(row)
            if len(out) >= limit:
                break
    return out


@app.get("/api/cache/search")
async def cache_search(q: str = Query(..., min_length=1, max_length=120), limit: int = Query(50, ge=1, le=500)) -> dict[str, Any]:
    return {"query": q, "rows": search_cache_rows(q, limit=limit), "cache_file": str(TARGET_CACHE)}


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


@app.post("/api/cache/build-rv-index")
async def build_rv_index() -> dict[str, Any]:
    script = await fetch_text(NASA_RADIAL_WGET, max_bytes=12_000_000)
    urls = extract_urls_from_wget_script(script)
    payload = {"source": NASA_RADIAL_WGET, "n_urls": len(urls), "urls": urls}
    write_json_file(RV_SOURCE_CACHE, payload)
    return {"status": "ok", "n_urls": len(urls), "cache_file": str(RV_SOURCE_CACHE)}


@app.get("/api/nasa-radial-index")
async def nasa_radial_index(offline: bool = False) -> dict[str, Any]:
    if offline:
        payload = load_json_file(RV_SOURCE_CACHE, {"urls": []})
        urls = payload.get("urls", []) if isinstance(payload, dict) else []
        return {"url": NASA_RADIAL_WGET, "offline": True, "n_urls": len(urls), "sample_urls": urls[:20]}
    script = await fetch_text(NASA_RADIAL_WGET, max_bytes=12_000_000)
    urls = extract_urls_from_wget_script(script)
    return {"url": NASA_RADIAL_WGET, "bytes": len(script.encode("utf-8", errors="replace")), "n_urls": len(urls), "sample_urls": urls[:20]}


@app.get("/api/rv-sources")
async def rv_sources(name: str = Query(..., min_length=1, max_length=120), offline: bool = False) -> dict[str, Any]:
    names = candidate_names(name)
    host_guess = names[0]
    target_rows: list[dict[str, Any]] = []
    if offline:
        target_rows = search_cache_rows(name, limit=10)
    else:
        try:
            rows = await fetch_json(NASA_TAP_SYNC, {"query": target_adql(name), "format": "json"})
            target_rows = rows if isinstance(rows, list) else []
        except Exception:
            target_rows = []

    if target_rows:
        host_guess = target_rows[0].get("hostname") or host_guess
        if target_rows[0].get("pl_name"):
            names.append(target_rows[0]["pl_name"])
        if target_rows[0].get("hostname"):
            names.append(target_rows[0]["hostname"])

    compact_candidates = {compact_key(n) for n in names if n}
    sources: list[dict[str, Any]] = []

    try:
        if offline:
            payload = load_json_file(RV_SOURCE_CACHE, {"urls": []})
            urls = payload.get("urls", []) if isinstance(payload, dict) else []
        else:
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
                "candidate match", True, "Matched against the NASA RADIAL bulk wget script/cache."
            ))
        script_status = f"scanned {len(urls)} RADIAL URLs; {len(matches)} candidate match(es)"
    except Exception as exc:
        script_status = f"could not scan RADIAL source list: {exc}"

    links = archive_links(names[0], host_guess)
    sources.extend([
        source_record("NASA Exoplanet Archive", "overview", "Planet host overview / associated time series", links["nasa_overview"], "manual source", False, "Open the overview page and enable Associated Data / Time Series if available."),
        source_record("NASA Exoplanet Archive", "bulk index", "RADIAL bulk wget script", links["nasa_radial_wget"], script_status, False, "Backend scans this file/cache for direct URLs; manual use is also possible."),
        source_record("CDS VizieR", "catalogue search", "VizieR cone/name search", links["vizier"], "manual source", False, "Use this to locate literature tables, then paste a machine-readable table URL into the universal importer."),
        source_record("CDS SIMBAD", "identity/bibliography", "SIMBAD object page", links["simbad"], "metadata source", False, "Use references/identifiers to trace original RV publications."),
        source_record("DACE", "RV ecosystem", "DACE exoplanets portal", links["dace"], "manual source", False, "DACE automated data access needs a dedicated API/authentication adapter."),
        source_record("MAST", "photometry", "MAST portal", links["mast"], "photometry source", False, "Use for TESS/Kepler photometry rather than RV tables."),
    ])

    return {"target": name, "candidate_names": names, "planet_rows": target_rows, "sources": sources, "offline": offline}


def parse_votable_table(text: str) -> Optional[dict[str, Any]]:
    stripped = text.lstrip()
    if not stripped.startswith("<") or "VOTABLE" not in stripped[:5000].upper():
        return None
    try:
        root = ET.fromstring(text)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse VOTable XML: {exc}")

    def strip_ns(tag: str) -> str:
        return tag.split("}", 1)[-1].lower()

    fields: list[str] = []
    tabledata = None
    for elem in root.iter():
        tag = strip_ns(elem.tag)
        if tag == "field":
            fields.append(elem.attrib.get("name") or elem.attrib.get("ID") or f"col_{len(fields)+1}")
        elif tag == "tabledata" and tabledata is None:
            tabledata = elem
    if tabledata is None:
        return None
    rows_raw: list[list[str]] = []
    for tr in list(tabledata):
        if strip_ns(tr.tag) != "tr":
            continue
        row: list[str] = []
        for td in list(tr):
            if strip_ns(td.tag) == "td":
                row.append((td.text or "").strip())
        if row:
            rows_raw.append(row)
    if not rows_raw:
        raise HTTPException(status_code=422, detail="VOTable has TABLEDATA but no rows")
    n_cols = max(len(r) for r in rows_raw[:50])
    if len(fields) < n_cols:
        fields = fields + [f"col_{i+1}" for i in range(len(fields), n_cols)]
    return {"columns": fields[:n_cols], "rows_raw": rows_raw, "header_tokens": fields[:n_cols], "n_cols": n_cols}


def detect_table(text: str) -> dict[str, Any]:
    vot = parse_votable_table(text)
    if vot is not None:
        return vot

    raw_lines = [ln.strip() for ln in text.splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
    if not raw_lines:
        raise HTTPException(status_code=422, detail="Remote/file has no parseable data rows")

    header_tokens: Optional[list[str]] = None
    data_start = 0
    for idx, line in enumerate(raw_lines[:40]):
        if re.search(r"[A-Za-z]", line) and len(re.split(r"[,;\t\s]+", line.strip())) >= 2:
            header_tokens = re.split(r"[,;\t\s]+", line.strip())
            data_start = idx + 1
            break

    data_lines = raw_lines[data_start:]
    if not data_lines:
        raise HTTPException(status_code=422, detail="File contains a header but no data rows")

    delimiter = None
    sample = "\n".join(data_lines[:10])
    if "," in sample:
        delimiter = ","
    elif ";" in sample:
        delimiter = ";"
    elif "\t" in sample:
        delimiter = "\t"

    if delimiter:
        reader = csv.reader(io.StringIO("\n".join(data_lines)), delimiter=delimiter)
        rows_raw = [[c.strip() for c in row] for row in reader if row]
    else:
        rows_raw = [re.split(r"\s+", ln.strip()) for ln in data_lines]

    if not rows_raw:
        raise HTTPException(status_code=422, detail="No data rows found")

    n_cols = max(len(r) for r in rows_raw[:50])
    columns = header_tokens if header_tokens and len(header_tokens) >= n_cols else [f"col_{i+1}" for i in range(n_cols)]
    return {"columns": columns, "rows_raw": rows_raw, "header_tokens": header_tokens, "n_cols": n_cols}


def guess_mapping(columns: list[str]) -> dict[str, Optional[str]]:
    lower = [c.lower().strip() for c in columns]

    def find(options: list[str], fallback: Optional[str] = None) -> Optional[str]:
        for opt in options:
            if opt in lower:
                return columns[lower.index(opt)]
        for i, h in enumerate(lower):
            if any(opt in h for opt in options):
                return columns[i]
        return fallback

    return {
        "time_col": find(["bjd", "bjd_tdb", "jd", "hjd", "time", "mjd"], columns[0] if columns else None),
        "rv_col": find(["rv", "vrad", "radvel", "velocity", "mnvel"], columns[1] if len(columns) > 1 else None),
        "err_col": find(["rv_err", "rverr", "e_rv", "err", "error", "sigma"], columns[2] if len(columns) > 2 else None),
        "inst_col": find(["instrument", "inst", "telescope", "facility"], None),
    }


def normalise_table(text: str, instrument: str, time_col: Optional[str] = None, rv_col: Optional[str] = None, err_col: Optional[str] = None, inst_col: Optional[str] = None) -> dict[str, Any]:
    table = detect_table(text)
    columns = table["columns"]
    rows_raw = table["rows_raw"]
    mapping = guess_mapping(columns)
    time_col = time_col or mapping["time_col"]
    rv_col = rv_col or mapping["rv_col"]
    err_col = err_col or mapping["err_col"]
    inst_col = inst_col or mapping["inst_col"]

    def idx(col: Optional[str]) -> Optional[int]:
        if not col:
            return None
        if col in columns:
            return columns.index(col)
        try:
            i = int(col)
            return i if 0 <= i < len(columns) else None
        except Exception:
            return None

    time_i = idx(time_col)
    rv_i = idx(rv_col)
    err_i = idx(err_col)
    inst_i = idx(inst_col)
    if time_i is None or rv_i is None:
        raise HTTPException(status_code=422, detail="Could not identify time and RV columns")

    rows: list[dict[str, Any]] = []
    rejected = 0
    for row in rows_raw:
        try:
            t = float(row[time_i])
            rv = float(row[rv_i])
            err = float(row[err_i]) if err_i is not None and err_i < len(row) else 1.0
            inst = row[inst_i] if inst_i is not None and inst_i < len(row) and row[inst_i] else instrument
            rows.append({"t": t, "rv": rv, "err": max(err, 0.0001), "inst": inst})
        except Exception:
            rejected += 1
    if len(rows) < 3:
        raise HTTPException(status_code=422, detail="Fewer than 3 usable RV rows after parsing")
    csv_lines = ["BJD,RV,RV_ERR,INSTRUMENT"]
    csv_lines.extend(f"{r['t']},{r['rv']},{r['err']},{r['inst']}" for r in rows)
    return {
        "rows": rows,
        "csv": "\n".join(csv_lines),
        "columns": ["BJD", "RV", "RV_ERR", "INSTRUMENT"],
        "raw_columns": columns,
        "mapping": {"time_col": columns[time_i], "rv_col": columns[rv_i], "err_col": columns[err_i] if err_i is not None else None, "inst_col": columns[inst_i] if inst_i is not None else None},
        "n_rows": len(rows),
        "rejected_rows": rejected,
    }


@app.get("/api/preview-rv-url")
async def preview_rv_url(url: str = Query(..., min_length=10, max_length=2000)) -> dict[str, Any]:
    text = await fetch_text(url)
    table = detect_table(text)
    sample_rows = table["rows_raw"][:12]
    return {
        "source_url": url,
        "raw_columns": table["columns"],
        "suggested_mapping": guess_mapping(table["columns"]),
        "sample_rows": sample_rows,
        "n_preview_rows": len(sample_rows),
        "n_columns": table["n_cols"],
    }


@app.get("/api/import-rv-url")
async def import_rv_url(
    url: str = Query(..., min_length=10, max_length=2000),
    instrument: str = "REMOTE",
    time_col: Optional[str] = None,
    rv_col: Optional[str] = None,
    err_col: Optional[str] = None,
    inst_col: Optional[str] = None,
) -> dict[str, Any]:
    text = await fetch_text(url)
    parsed = normalise_table(text, instrument=instrument, time_col=time_col, rv_col=rv_col, err_col=err_col, inst_col=inst_col)
    parsed["source_url"] = url
    parsed["source"] = "remote machine-readable RV table"
    return parsed


@app.post("/api/preview-rv-upload")
async def preview_rv_upload(file: UploadFile = File(...)) -> dict[str, Any]:
    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    table = detect_table(text)
    return {
        "filename": file.filename,
        "raw_columns": table["columns"],
        "suggested_mapping": guess_mapping(table["columns"]),
        "sample_rows": table["rows_raw"][:12],
        "n_preview_rows": min(12, len(table["rows_raw"])),
        "n_columns": table["n_cols"],
    }


@app.post("/api/import-rv-upload")
async def import_rv_upload(
    file: UploadFile = File(...),
    instrument: str = Form("UPLOAD"),
    time_col: Optional[str] = Form(None),
    rv_col: Optional[str] = Form(None),
    err_col: Optional[str] = Form(None),
    inst_col: Optional[str] = Form(None),
) -> dict[str, Any]:
    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    parsed = normalise_table(text, instrument=instrument, time_col=time_col, rv_col=rv_col, err_col=err_col, inst_col=inst_col)
    parsed["filename"] = file.filename
    parsed["source"] = "uploaded RV/VOTable file"
    return parsed
