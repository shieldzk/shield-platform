import { describe, expect, test } from "bun:test"
import express from "express"
import { pino } from "pino"
import request from "supertest"
import { z } from "zod"

import { createApp } from "./app"
import { jsonReplacer } from "./lib/json"
import { validated } from "./lib/validated"
import { errorHandler } from "./middleware/error-handler"
import type { ReadinessCheck } from "./routes/health"

function makeApp(readinessChecks: Record<string, ReadinessCheck> = {}) {
  return createApp({
    config: { CORS_ORIGINS: ["http://localhost:5173"] },
    logger: pino({ level: "silent" }),
    readinessChecks,
  })
}

describe("health", () => {
  test("GET /health returns ok and a request id", async () => {
    const res = await request(makeApp()).get("/health")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: "ok" })
    expect(res.headers["x-request-id"]).toBeString()
  })

  test("a well-formed incoming request id is reused", async () => {
    const res = await request(makeApp())
      .get("/health")
      .set("x-request-id", "trace-123")
    expect(res.headers["x-request-id"]).toBe("trace-123")
  })

  test("a malformed incoming request id is replaced", async () => {
    const res = await request(makeApp())
      .get("/health")
      .set("x-request-id", "not a valid id")
    expect(res.headers["x-request-id"]).not.toBe("not a valid id")
  })

  test("GET /ready returns 200 when every check passes", async () => {
    const res = await request(makeApp({ mongo: async () => {} })).get("/ready")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: "ok", checks: { mongo: "ok" } })
  })

  test("GET /ready returns 503 and names the failing check", async () => {
    const app = makeApp({
      mongo: async () => {
        throw new Error("connection refused")
      },
    })
    const res = await request(app).get("/ready")
    expect(res.status).toBe(503)
    expect(res.body).toEqual({
      status: "unavailable",
      checks: { mongo: "failed" },
    })
  })
})

describe("errors", () => {
  test("unknown routes return a 404 error body", async () => {
    const res = await request(makeApp()).get("/nope")
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("not_found")
  })

  test("malformed JSON returns 400", async () => {
    const res = await request(makeApp())
      .post("/health")
      .set("content-type", "application/json")
      .send("{")
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("bad_request")
  })

  test("oversized bodies return 413", async () => {
    const res = await request(makeApp())
      .post("/health")
      .send({ blob: "x".repeat(1_100_000) })
    expect(res.status).toBe(413)
    expect(res.body.error.code).toBe("payload_too_large")
  })

  test("unexpected errors return a generic 500 without internals", async () => {
    const app = express()
      .get("/boom", () => {
        throw new Error("secret internal detail")
      })
      .use(errorHandler)
    const res = await request(app).get("/boom")
    expect(res.status).toBe(500)
    expect(res.body).toEqual({
      error: { code: "internal_error", message: "Internal server error" },
    })
  })
})

describe("validated", () => {
  const app = express()
    .set("json replacer", jsonReplacer)
    .use(express.json())
    .post(
      "/batches/:batchId/allocations",
      validated(
        {
          params: z.object({ batchId: z.coerce.bigint().nonnegative() }),
          body: z.object({ amount: z.coerce.bigint().positive() }),
        },
        ({ params, body }, _req, res) => {
          res.json({ batchId: params.batchId, amount: body.amount })
        }
      )
    )
    .use(errorHandler)

  test("passes parsed, typed input to the handler; bigints go out as strings", async () => {
    const res = await request(app)
      .post("/batches/42/allocations")
      .send({ amount: "50" })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ batchId: "42", amount: "50" })
  })

  test("rejects invalid input with a 400 listing the issues", async () => {
    const res = await request(app)
      .post("/batches/42/allocations")
      .send({ amount: "-5" })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("validation_error")
    expect(res.body.error.details).toEqual([
      { code: "too_small", path: ["amount"], message: expect.any(String) },
    ])
  })
})
