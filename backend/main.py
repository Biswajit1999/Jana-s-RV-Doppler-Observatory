from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

NASA_TAP_SYNC = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"

app = FastAPI(title="Jana RV Doppler Observatory API", version="0.3.0")

origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000,https://biswajit1999.github.io",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


def clean_name(name: str) -> str:
    cleaned = " ".join(name.strip().split())
    if not cleaned or len(cleaned) > 120:
        raise HTTPException(status_code=400, detail="Invalid target name")
    return cleaned.replace("'", "''")


def target_adql(name: str) -> str:
    q = clean_name(name).lower()
    return f"""
        select top 10
            pl_name, hostname, discoverymethod, disc_year,
            ra, dec, sy_dist, st_spectype, sy_vmag,
            pl_orbper, pl_rvamp, pl_orbeccen, pl_bmassj, pl_orbsmax,
            default_flag
        from ps
        where default_flag = 1
          and (lower(pl_name) like '%{q}%' or lower(hostname) like '%{q}%')
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
    return {"status": "ok", "service": "jana-rv-api"}


@app.get("/api/nasa-tap")
async def nasa_tap(query: str = Query(..., min_length=8, max_length=8000)) -> Any:
    return await fetch_json(NASA_TAP_SYNC, {"query": query, "format": "json"})


@app.get("/api/target")
async def target(name: str = Query(..., min_length=1, max_length=120)) -> dict[str, Any]:
    adql = target_adql(name)
    rows = await fetch_json(NASA_TAP_SYNC, {"query": adql, "format": "json"})
    planet = rows[0] if isinstance(rows, list) and rows else {}
    simbad_name = planet.get("hostname") or name
    return {
        "source": "NASA Exoplanet Archive TAP via Jana FastAPI proxy",
        "query": adql,
        "planet": planet,
        "nasa_rows": rows if isinstance(rows, list) else [],
        "links": {
            "nasa_overview": f"https://exoplanetarchive.ipac.caltech.edu/overview/{planet.get('pl_name', name)}",
            "simbad": f"https://simbad.cds.unistra.fr/simbad/sim-id?Ident={simbad_name}",
            "gaia": "https://gea.esac.esa.int/archive/",
            "mast": "https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html",
        },
    }
