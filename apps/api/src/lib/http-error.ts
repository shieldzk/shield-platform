/** An error whose status, code and message are safe to send to the client. */
export class HttpError extends Error {
  override readonly name = "HttpError"
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}
