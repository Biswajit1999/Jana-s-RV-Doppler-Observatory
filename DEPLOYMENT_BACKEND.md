# Optional backend proxy

The browser may block direct archive requests from GitHub Pages. Use this optional FastAPI proxy when deploying to Render, Railway, Fly.io, or a small VPS.

```bash
cd backend
pip install -r requirements.txt
uvicorn fastapi_proxy:app --reload --port 8000
```

Then change the frontend TAP endpoint in `app.js` from the NASA URL to your backend URL, for example:

```js
const NASA_TAP = "https://your-backend.example.com/api/nasa-tap";
```

For production, restrict CORS to your GitHub Pages domain and add rate limiting/cache control.
