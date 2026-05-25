from __future__ import annotations

import os
import re
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

NASA_TAP_SYNC = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"

app = FastAPI(title="Jana RV Doppler Observatory API", version="0.3.1")

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


def candidate_names(name: str) -> list[str]:
    cleaned = clean_name(name)
    key = normalise_key(cleaned)
    candidates: list[str] = [cleaned]

    if key in ALIASES:
        candidates.extend(ALIASES[key])

    # Generic fallback: if a planet suffix is present, also query the host part.
    # Example: "HD 189733 b" -> "HD 189733".
    bits = cleaned.split()
    if len(bits) > 2 and len(bits[-1]) == 1 and bits[-1].isalpha():
        candidates.append(" ".join(bits[:-1]))

    # Useful shorthand fallback for Bayer-style names commonly used differently
    # across archives: "51 Pegasi b" is stored by NASA as "51 Peg b".
    if "pegasi" in key:
        candidates.append(re.sub("pegasi", "Peg", cleaned, flags=re.IGNORECASE))
        candidates.append(re.sub("pegasi b", "Peg b", cleaned, flags=re.IGNORECASE))

    # Remove duplicates while preserving order.
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


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "jana-rv-api", "version": "0.3.1"}


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
        "links": {
            "nasa_overview": f"https://exoplanetarchive.ipac.caltech.edu/overview/{display_name}",
            "simbad": f"https://simbad.cds.unistra.fr/simbad/sim-id?Ident={simbad_name}",
            "gaia": "https://gea.esac.esa.int/archive/",
            "mast": "https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html",
        },
    }
