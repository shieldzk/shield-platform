import type { Request, RequestHandler, Response } from "express"
import type { z } from "zod"

type RequestSchemas = {
  params?: z.ZodType
  query?: z.ZodType
  body?: z.ZodType
}

/** The parsed parts of a request, typed from the schemas given to `validated`. */
export type ValidatedInput<S extends RequestSchemas> = {
  [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never
}

/**
 * Wraps a handler so that params, query and body are parsed with zod first.
 *
 * Express 5 makes `req.query` read-only, so the parsed values are passed to the
 * handler instead of being written back onto `req`. A failed parse throws a
 * ZodError, which Express 5 forwards to the error handler (a 400).
 */
export function validated<S extends RequestSchemas, ResBody = unknown>(
  schemas: S,
  handler: (
    input: ValidatedInput<S>,
    req: Request,
    res: Response<ResBody>
  ) => void | Promise<void>
): RequestHandler {
  return async (req, res) => {
    const input = {
      ...(schemas.params && {
        params: await schemas.params.parseAsync(req.params),
      }),
      ...(schemas.query && {
        query: await schemas.query.parseAsync(req.query),
      }),
      ...(schemas.body && { body: await schemas.body.parseAsync(req.body) }),
    } as ValidatedInput<S>
    await handler(input, req, res)
  }
}
