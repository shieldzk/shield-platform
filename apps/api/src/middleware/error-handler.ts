import { STATUS_CODES } from "node:http"

import type { ErrorRequestHandler, RequestHandler } from "express"
import { ZodError } from "zod"

import { HttpError } from "../lib/http-error"

/** Shape of every error response. */
export type ErrorBody = {
  error: { code: string; message: string; details?: unknown }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, "not_found", `Cannot ${req.method} ${req.path}`))
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req,
  res,
  next
) => {
  // Once the response has started, only Express's default handler can end it.
  if (res.headersSent) {
    next(err)
    return
  }
  const { status, body } = toErrorResponse(err)
  // pino-http logs res.err with the request, so server errors keep their stack.
  if (status >= 500) {
    res.err = err instanceof Error ? err : new Error(String(err))
  }
  res.status(status).json(body)
}

function toErrorResponse(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof HttpError) {
    const { status, code, message, details } = err
    return { status, body: { error: { code, message, details } } }
  }
  if (err instanceof ZodError) {
    // Only code, path and message: other issue fields can hold bigints or echo input.
    const details = err.issues.map(({ code, path, message }) => ({
      code,
      path,
      message,
    }))
    return {
      status: 400,
      body: {
        error: {
          code: "validation_error",
          message: "Invalid request",
          details,
        },
      },
    }
  }
  // express.json() errors (malformed JSON, body too large) use the http-errors shape.
  if (isExposedClientError(err)) {
    return {
      status: err.status,
      body: { error: { code: statusCode(err.status), message: err.message } },
    }
  }
  return {
    status: 500,
    body: {
      error: { code: "internal_error", message: "Internal server error" },
    },
  }
}

function isExposedClientError(err: unknown): err is Error & { status: number } {
  return (
    err instanceof Error &&
    "status" in err &&
    typeof err.status === "number" &&
    err.status >= 400 &&
    err.status < 500 &&
    "expose" in err &&
    err.expose === true
  )
}

/** 413 -> "payload_too_large" */
function statusCode(status: number): string {
  return (
    STATUS_CODES[status]?.toLowerCase().replaceAll(" ", "_") ?? "client_error"
  )
}
