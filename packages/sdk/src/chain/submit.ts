import { rpc, type Transaction } from "@stellar/stellar-sdk"
import type {
  AssembledTransaction,
  SignTransaction,
} from "@stellar/stellar-sdk/contract"

import { VaultContractError, toVaultError } from "./errors"

/** Where a submission is. The transaction's hash is known from "submitting" on. */
export type SubmitStage = "signing" | "submitting" | "confirming"

/** Why a submission didn't confirm. */
export type SubmitErrorCode = keyof typeof SUBMIT_ERROR_MESSAGES

const SUBMIT_ERROR_MESSAGES = {
  /** The network kept asking us to try again later. Safe to retry. */
  busy: "The network is busy. Try again in a moment.",
  /** The network refused the transaction before running it. */
  rejected: "The network rejected the transaction.",
  /** It can no longer be included in a ledger. Safe to build it again and retry. */
  expired: "The transaction expired before it was included. Try again.",
  /** It ran and failed on-chain, for a reason other than a vault error. */
  failed: "The transaction failed on-chain.",
  /** Its outcome is still unknown. Check `hash` again later; don't resubmit. */
  pending: "The transaction was sent but hasn't confirmed yet.",
} as const

/** A submission that didn't confirm. `code` says why, and whether it's safe to retry. */
export class SubmitError extends Error {
  override readonly name = "SubmitError"

  constructor(
    readonly code: SubmitErrorCode,
    readonly hash?: string,
    detail?: string
  ) {
    super(
      detail
        ? `${SUBMIT_ERROR_MESSAGES[code]} (${detail})`
        : SUBMIT_ERROR_MESSAGES[code]
    )
  }
}

/** The RPC calls a submission makes. Tests pass a fake. */
export type SubmitServer = Pick<
  rpc.Server,
  "sendTransaction" | "getTransaction" | "simulateTransaction"
>

/** What submitTransaction needs from a built vault call (e.g. a VaultTransaction). */
export type SubmittableTransaction = Pick<
  AssembledTransaction<unknown>,
  "sign" | "signed" | "built" | "options"
>

export interface SubmitOptions {
  /** Signs the transaction, e.g. the connected wallet's `signTransaction`. */
  signTransaction: SignTransaction
  /** Called as the submission moves on, e.g. to drive a progress indicator. */
  onStage?: (stage: SubmitStage, hash?: string) => void
  /** RPC client to use. Default: one for the transaction's `rpcUrl`. */
  server?: SubmitServer
  /** Wait between status checks, and the base of the retry backoff. Default 1000. */
  pollIntervalMs?: number
}

export interface SubmittedTransaction {
  hash: string
  /** Ledger the transaction was included in. */
  ledger: number
}

/** Attempts at sending before giving up on a busy network. */
const SEND_ATTEMPTS = 5

/**
 * Signs `tx`, sends it, and waits until it's confirmed.
 *
 * Throws a VaultContractError if the vault rejected the call on-chain (e.g. a claim
 * that lost a race to the same nullifier), or a SubmitError otherwise. Retries only
 * ever resend the same signed transaction, so a submission can't happen twice.
 */
export async function submitTransaction(
  tx: SubmittableTransaction,
  options: SubmitOptions
): Promise<SubmittedTransaction> {
  const { signTransaction, onStage, pollIntervalMs = 1000 } = options
  const server =
    options.server ??
    new rpc.Server(tx.options.rpcUrl, { allowHttp: tx.options.allowHttp })

  onStage?.("signing")
  await tx.sign({ signTransaction })
  const signed = tx.signed!
  const hash = toHex(signed.hash())

  onStage?.("submitting", hash)
  await send(server, signed, hash, pollIntervalMs)

  onStage?.("confirming", hash)
  const notAfter = Number(signed.timeBounds?.maxTime ?? 0)
  const result = await waitForTransaction(
    server,
    hash,
    notAfter,
    pollIntervalMs
  )
  if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    return { hash, ledger: result.ledger }
  }
  throw await failureReason(server, tx, hash)
}

/**
 * Polls `hash` until it's in a ledger. Throws SubmitError "expired" once the network
 * has closed a ledger after `notAfter` (the transaction's maxTime, in Unix seconds)
 * without including it, since it then never can be.
 */
export async function waitForTransaction(
  server: SubmitServer,
  hash: string,
  notAfter: number,
  pollIntervalMs = 1000
): Promise<
  | rpc.Api.GetSuccessfulTransactionResponse
  | rpc.Api.GetFailedTransactionResponse
> {
  // Without a time bound, give up after the SDK's default timeout instead
  const deadline = notAfter || Math.floor(Date.now() / 1000) + 300
  for (;;) {
    const response = await server.getTransaction(hash).catch(() => undefined)
    if (response) {
      if (response.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
        return response
      }
      if (response.latestLedgerCloseTime > deadline) {
        throw new SubmitError("expired", hash)
      }
    } else if (Date.now() / 1000 > deadline + 60) {
      // The RPC has been unreachable past the deadline: the outcome is unknown
      throw new SubmitError("pending", hash)
    }
    await sleep(pollIntervalMs)
  }
}

async function send(
  server: SubmitServer,
  signed: Transaction,
  hash: string,
  pollIntervalMs: number
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const response = await server.sendTransaction(signed)
    switch (response.status) {
      case "PENDING":
      case "DUPLICATE": // Already received: track the same hash
        return
      case "TRY_AGAIN_LATER":
        if (attempt === SEND_ATTEMPTS) throw new SubmitError("busy", hash)
        await sleep(pollIntervalMs * 2 ** attempt)
        continue
      case "ERROR": {
        const reason = response.errorResult?.result.type
        throw new SubmitError(
          reason === "txTooLate" ? "expired" : "rejected",
          hash,
          reason
        )
      }
      default: // A status this code doesn't know; don't loop on it
        throw new SubmitError("rejected", hash, response.status)
    }
  }
}

/**
 * Works out why a confirmed-but-failed transaction failed. The ledger doesn't say,
 * but simulating the call again does: a claim that lost a race to the same nullifier
 * now simulates as NullifierUsed.
 */
async function failureReason(
  server: SubmitServer,
  tx: SubmittableTransaction,
  hash: string
): Promise<VaultContractError | SubmitError> {
  const simulation = await server
    .simulateTransaction(tx.built!)
    .catch(() => undefined)
  const error =
    simulation && "error" in simulation
      ? toVaultError(simulation.error)
      : undefined
  return error ?? new SubmitError("failed", hash)
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
