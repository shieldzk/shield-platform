# Web image. Build from the repo root:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com .
# VITE_* values are baked in at build time, so changing them needs a rebuild.
FROM oven/bun:1.4.4 AS bun

FROM node:22-bookworm-slim
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

ARG VITE_API_URL
ARG VITE_TOKEN_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
ENV VITE_API_URL=$VITE_API_URL \
    VITE_TOKEN_CONTRACT_ID=$VITE_TOKEN_CONTRACT_ID

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

WORKDIR /app/apps/web
RUN bun run build

ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000
CMD ["bun", "run", "start"]
