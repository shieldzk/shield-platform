import { Router, type Response } from "express"

/** Resolves if a dependency is usable, rejects otherwise. */
export type ReadinessCheck = () => Promise<void>

export type HealthResponse = { status: "ok" }

export type ReadinessResponse = {
  status: "ok" | "unavailable"
  checks: Record<string, "ok" | "failed">
}

export function healthRouter(checks: Record<string, ReadinessCheck>): Router {
  const router = Router()

  // Liveness: the process is up and serving requests.
  router.get("/health", (_req, res: Response<HealthResponse>) => {
    res.json({ status: "ok" })
  })

  // Readiness: every dependency the API needs is reachable.
  router.get("/ready", async (req, res: Response<ReadinessResponse>) => {
    const results = await Promise.all(
      Object.entries(checks).map(async ([name, check]) => {
        try {
          await check()
          return [name, "ok"] as const
        } catch (err) {
          req.log.warn({ err, check: name }, "readiness check failed")
          return [name, "failed"] as const
        }
      })
    )
    const ready = results.every(([, result]) => result === "ok")
    res.status(ready ? 200 : 503).json({
      status: ready ? "ok" : "unavailable",
      checks: Object.fromEntries(results),
    })
  })

  return router
}
