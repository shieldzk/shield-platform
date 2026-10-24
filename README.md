# ShieldZK platform

Confidential disbursements for the Stellar Disbursement Platform (SDP).

## Requirements

- [Bun](https://bun.sh) 1.4 or newer
- [Docker](https://docs.docker.com/get-docker/), to run MongoDB locally

## Install

```bash
git clone git@github.com:shieldzk/shield-platform.git
cd shield-platform
bun install
cp apps/api/.env.example apps/api/.env
```

## Run

```bash
docker compose up -d   # start MongoDB
bun run dev            # start the API and the web app
```

- Web app: http://localhost:5173
- API: http://localhost:4000 (check http://localhost:4000/ready)

Stop with `Ctrl+C`, then `docker compose down` to stop MongoDB.

To run one app only: `bun run dev --filter=api` or `bun run dev --filter=web`.

## Other commands

```bash
bun run test        # run tests
bun run typecheck   # type-check every package
bun run build       # production build
```
