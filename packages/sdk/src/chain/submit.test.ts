import { describe, expect, test } from "bun:test"
import {
  Account,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  rpc,
  type Transaction,
} from "@stellar/stellar-sdk"

import { VaultContractError } from "./errors"
import {
  SubmitError,
  submitTransaction,
  type SubmitServer,
  type SubmitStage,
  type SubmittableTransaction,
} from "./submit"

const { NOT_FOUND, SUCCESS, FAILED } = rpc.Api.GetTransactionStatus
const NOW = Math.floor(Date.now() / 1000)

/** A real signed transaction, built offline, valid until `maxTime`. */
function fakeTx(maxTime = NOW + 300): SubmittableTransaction {
  const keypair = Keypair.random()
  const built = new TransactionBuilder(new Account(keypair.publicKey(), "1"), {
    fee: "100",
    networkPassphrase: Networks.STANDALONE,
    timebounds: { minTime: 0, maxTime },
  })
    .addOperation(Operation.bumpSequence({ bumpTo: "2" }))
    .build()
  const tx = {
    built,
    signed: undefined as Transaction | undefined,
    options: {
      rpcUrl: "http://127.0.0.1:9",
      networkPassphrase: Networks.STANDALONE,
    },
    sign: async () => {
      built.sign(keypair)
      tx.signed = built
    },
  }
  return tx as unknown as SubmittableTransaction
}

type Send = Awaited<ReturnType<SubmitServer["sendTransaction"]>>
type Get = Awaited<ReturnType<SubmitServer["getTransaction"]>>
type Simulate = Awaited<ReturnType<SubmitServer["simulateTransaction"]>>

/** Fake RPC: answers each call with the next scripted response (the last one repeats). */
function fakeServer(script: {
  send: Partial<Send>[]
  get?: Partial<Get>[]
  simulate?: Partial<Simulate>
}) {
  const calls = { send: 0, get: 0, simulate: 0 }
  const next = <T>(list: T[], i: number) => list[Math.min(i, list.length - 1)]!
  const server: SubmitServer = {
    sendTransaction: async () =>
      ({
        hash: "",
        latestLedger: 1,
        latestLedgerCloseTime: NOW,
        ...next(script.send, calls.send++),
      }) as Send,
    getTransaction: async () =>
      ({
        latestLedger: 1,
        latestLedgerCloseTime: NOW,
        ...next(script.get ?? [{ status: NOT_FOUND }], calls.get++),
      }) as Get,
    simulateTransaction: async () => {
      calls.simulate++
      return (script.simulate ?? {}) as Simulate
    },
  }
  return { server, calls }
}

const sign = async () => ({ signedTxXdr: "" })
const fast = { signTransaction: sign, pollIntervalMs: 0 }

describe("submitTransaction", () => {
  test("signs, sends and confirms, reporting each stage with the hash", async () => {
    const { server } = fakeServer({
      send: [{ status: "PENDING" }],
      get: [{ status: NOT_FOUND }, { status: SUCCESS, ledger: 42 }],
    })
    const stages: [SubmitStage, string | undefined][] = []
    const result = await submitTransaction(fakeTx(), {
      ...fast,
      server,
      onStage: (stage, hash) => stages.push([stage, hash]),
    })

    expect(result.ledger).toBe(42)
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(stages).toEqual([
      ["signing", undefined],
      ["submitting", result.hash],
      ["confirming", result.hash],
    ])
  })

  test("treats DUPLICATE as already sent and keeps tracking", async () => {
    const { server, calls } = fakeServer({
      send: [{ status: "DUPLICATE" }],
      get: [{ status: SUCCESS, ledger: 7 }],
    })
    expect(
      (await submitTransaction(fakeTx(), { ...fast, server })).ledger
    ).toBe(7)
    expect(calls.send).toBe(1)
  })

  test("resends on TRY_AGAIN_LATER, then gives up with 'busy'", async () => {
    const recovers = fakeServer({
      send: [
        { status: "TRY_AGAIN_LATER" },
        { status: "TRY_AGAIN_LATER" },
        { status: "PENDING" },
      ],
      get: [{ status: SUCCESS, ledger: 1 }],
    })
    await submitTransaction(fakeTx(), { ...fast, server: recovers.server })
    expect(recovers.calls.send).toBe(3)

    const stuck = fakeServer({ send: [{ status: "TRY_AGAIN_LATER" }] })
    const error = await submitTransaction(fakeTx(), {
      ...fast,
      server: stuck.server,
    }).catch((e) => e)
    expect(error).toBeInstanceOf(SubmitError)
    expect(error.code).toBe("busy")
    expect(stuck.calls.send).toBe(5)
  })

  test("maps a refused transaction to 'expired' or 'rejected'", async () => {
    for (const [type, code] of [
      ["txTooLate", "expired"],
      ["txBadSeq", "rejected"],
    ] as const) {
      const { server } = fakeServer({
        send: [{ status: "ERROR", errorResult: { result: { type } } as never }],
      })
      const error = await submitTransaction(fakeTx(), {
        ...fast,
        server,
      }).catch((e) => e)
      expect(error).toBeInstanceOf(SubmitError)
      expect(error.code).toBe(code)
      expect(error.message).toContain(type)
    }
  })

  test("reports 'expired' once a ledger closes after the time bound without it", async () => {
    const { server } = fakeServer({
      send: [{ status: "PENDING" }],
      get: [
        { status: NOT_FOUND },
        { status: NOT_FOUND, latestLedgerCloseTime: NOW + 301 },
      ],
    })
    const error = await submitTransaction(fakeTx(NOW + 300), {
      ...fast,
      server,
    }).catch((e) => e)
    expect(error).toBeInstanceOf(SubmitError)
    expect(error.code).toBe("expired")
    expect(error.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  test("explains an on-chain failure by simulating the call again", async () => {
    const lostRace = fakeServer({
      send: [{ status: "PENDING" }],
      get: [{ status: FAILED, ledger: 9 }],
      simulate: { error: "HostError: Error(Contract, #2)\n\nEvent log..." },
    })
    const error = await submitTransaction(fakeTx(), {
      ...fast,
      server: lostRace.server,
    }).catch((e) => e)
    expect(error).toBeInstanceOf(VaultContractError)
    expect(error.code).toBe("NullifierUsed")

    const unexplained = fakeServer({
      send: [{ status: "PENDING" }],
      get: [{ status: FAILED, ledger: 9 }],
      simulate: {},
    })
    const other = await submitTransaction(fakeTx(), {
      ...fast,
      server: unexplained.server,
    }).catch((e) => e)
    expect(other).toBeInstanceOf(SubmitError)
    expect(other.code).toBe("failed")
  })

  test("doesn't send when signing fails (e.g. the user cancels in the wallet)", async () => {
    const { server, calls } = fakeServer({ send: [{ status: "PENDING" }] })
    const tx = fakeTx()
    tx.sign = async () => {
      throw new Error("User declined")
    }
    await expect(submitTransaction(tx, { ...fast, server })).rejects.toThrow(
      "User declined"
    )
    expect(calls.send).toBe(0)
  })
})
