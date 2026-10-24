import { pino, type Logger } from "pino"

import type { Config } from "../config/env"

export function createLogger({
  LOG_LEVEL,
  NODE_ENV,
}: Pick<Config, "LOG_LEVEL" | "NODE_ENV">): Logger {
  return pino({
    level: LOG_LEVEL,
    redact: ["req.headers.authorization", "req.headers.cookie"],
    ...(NODE_ENV === "development" && {
      transport: { target: "pino-pretty" },
    }),
  })
}
