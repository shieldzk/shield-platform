import cors from "cors"
import express, { type Express } from "express"
import helmet from "helmet"
import type { Logger } from "pino"
import { pinoHttp } from "pino-http"

import type { Config } from "./config/env"
import { jsonReplacer } from "./lib/json"
import { errorHandler, notFound } from "./middleware/error-handler"
import { healthRouter, type ReadinessCheck } from "./routes/health"

export type AppDeps = {
  config: Pick<Config, "CORS_ORIGINS">
  logger: Logger
  readinessChecks: Record<string, ReadinessCheck>
}

// Accept a caller's request id only if it is short and log-safe.
const REQUEST_ID = /^[\w-]{1,128}$/

const PROBE_PATHS = new Set(["/health", "/ready"])

export function createApp({
  config,
  logger,
  readinessChecks,
}: AppDeps): Express {
  const app = express()
  app.set("json replacer", jsonReplacer)

  // Request logs carry no bodies or headers: bodies can hold allocation amounts and
  // claim secrets. Keep it that way: log ids and counts, not payloads.
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"]
        const id =
          typeof incoming === "string" && REQUEST_ID.test(incoming)
            ? incoming
            : crypto.randomUUID()
        res.setHeader("x-request-id", id)
        return id
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error"
        if (res.statusCode >= 400) return "warn"
        return "info"
      },
      autoLogging: { ignore: (req) => PROBE_PATHS.has(req.url ?? "") },
    })
  )
  app.use(helmet())
  app.use(cors({ origin: config.CORS_ORIGINS }))
  app.use(express.json({ limit: "1mb" }))

  app.use(healthRouter(readinessChecks))
  // Feature routers mount under /v1.

  app.use(notFound)
  app.use(errorHandler)

  return app
}
