import { createServer } from "node:http"

import { createApp } from "./app"
import { loadConfig } from "./config/env"
import { connectMongo } from "./db/mongo"
import { createLogger } from "./lib/logger"

const SHUTDOWN_TIMEOUT_MS = 10_000

const config = loadConfig()
const logger = createLogger(config)

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled rejection")
  process.exit(1)
})
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception")
  process.exit(1)
})

const mongo = await connectMongo(config.MONGODB_URI).catch((err: unknown) => {
  logger.fatal({ err }, "could not connect to MongoDB")
  process.exit(1)
})

const app = createApp({
  config,
  logger,
  readinessChecks: {
    mongo: async () => {
      await mongo.db.command({ ping: 1 })
    },
  },
})

const server = createServer(app)

server.on("error", (err) => {
  logger.fatal({ err }, "server error")
  process.exit(1)
})

server.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "api listening")
})

let shuttingDown = false

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, "shutting down")

  const forceExit = setTimeout(() => {
    logger.error("shutdown timed out, forcing exit")
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  forceExit.unref()

  try {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    )
    await mongo.client.close()
    logger.info("shutdown complete")
    process.exit(0)
  } catch (err) {
    logger.error({ err }, "shutdown failed")
    process.exit(1)
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown(signal))
}
