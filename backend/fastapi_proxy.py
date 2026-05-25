from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI(title="Jana RV Doppler Observatory API Proxy")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

NASA_TAP = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"

@app.get("/api/nasa-tap")
async def nasa_tap(query: str, format: str = "json"):
    if not query.lower().strip().startswith("select"):
        raise HTTPException(status_code=400, detail="Only SELECT ADQL queries are allowed")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(NASA_TAP, params={"query": query, "format": format})
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text[:500])
    if format == "json":
        return r.json()
    return {"text": r.text}
