# API image. Build from the repo root:
#   docker build -f apps/api/Dockerfile .
# Bun runs the API; Node is there too because conservation proofs run in a Node
# child process (snarkjs hangs under Bun).
FROM oven/bun:1.4.4 AS bun

FROM node:22-bookworm-slim
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

ENV NODE_ENV=production \
    PORT=4000 \
    NODE_OPTIONS=--max-old-space-size=6144
EXPOSE 4000

WORKDIR /app/apps/api
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["./docker-entrypoint.sh"]
