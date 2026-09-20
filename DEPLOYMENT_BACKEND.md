# Optional FastAPI backend deployment

The GitHub Pages application is static. Run the optional backend when live NASA metadata or bounded remote-table imports are required.

## Local run

```bash
python -m pip install -r backend/requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8010
```

Set the interface’s API Base URL to `http://127.0.0.1:8010`, then verify:

```text
GET /api/health
GET /api/target?name=51%20Peg%20b
```

## Implemented request controls

- CORS defaults to localhost plus `https://biswajit1999.github.io` and can be replaced with `ALLOWED_ORIGINS`;
- remote imports accept only named astronomy hosts;
- every redirect target is revalidated and redirect depth is capped;
- remote tables and uploads are capped at 12 MB;
- response bytes are counted while streaming rather than after full download;
- the public TAP route permits one `SELECT` ADQL query only.

## Production requirements

Before exposing the backend publicly, add authentication for cache-building endpoints, rate limiting, structured request/error logs, health monitoring, infrastructure-level outbound-network policy, TLS termination, and a persistent cache outside the repository checkout.

The allowlist and byte caps reduce risk but are not a complete production security boundary. Do not run the development `--reload` mode on a public host.
