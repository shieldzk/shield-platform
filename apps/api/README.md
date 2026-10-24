# api

Express 5 API, run on Bun.

```bash
cp .env.example .env   # Bun loads .env automatically
bun run dev            # watch mode on :4000 (needs MongoDB: `docker compose up -d` at the root)
bun test
```

## Layout

| Path | What |
|---|---|
| `src/index.ts` | Boot: config, MongoDB, HTTP server, graceful shutdown |
| `src/app.ts` | `createApp()`: middleware, routers, error handling. Does no I/O, so tests use it directly |
| `src/config/env.ts` | Environment schema; invalid config fails the boot |
| `src/routes/` | Routers. Feature routers mount under `/v1` |
| `src/lib/validated.ts` | Typed request parsing for handlers |
| `src/middleware/error-handler.ts` | One JSON error shape for every failure |

## Conventions

- Parse requests with `validated({ params, query, body }, handler)`. The handler
  gets typed, parsed input; a failed parse becomes a 400.
- Throw `HttpError(status, code, message)` for expected failures. Anything else
  becomes a generic 500, with the stack in the logs only.
- Errors look like `{ "error": { "code": "...", "message": "...", "details": ... } }`.
- Bigints (amounts, field elements) go out as decimal strings.
- Never log request bodies or claim data: they hold allocation amounts and secrets.

## Endpoints

| Route | |
|---|---|
| `GET /health` | Liveness |
| `GET /ready` | Readiness: pings MongoDB, 503 if a dependency is down |
