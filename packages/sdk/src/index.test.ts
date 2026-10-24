import { describe, expect, test } from "bun:test"

import {
  FIELD_SIZE,
  MAX_ALLOCATIONS,
  MAX_AMOUNT,
  NULLIFIER_DOMAIN,
  generateSecret,
  isFieldElement,
} from "./index"

describe("protocol constants", () => {
  test("NULLIFIER_DOMAIN is ASCII 'shieldzk.nullifier'", () => {
    const hex = NULLIFIER_DOMAIN.toString(16)
    const text = new TextDecoder().decode(
      Uint8Array.from(hex.match(/../g)!, (byte) => parseInt(byte, 16))
    )
    expect(text).toBe("shieldzk.nullifier")
  })

  test("a full batch of maximum amounts cannot wrap the field", () => {
    expect(BigInt(MAX_ALLOCATIONS) * MAX_AMOUNT).toBeLessThan(FIELD_SIZE)
  })
})

describe("isFieldElement", () => {
  test("accepts 0 and FIELD_SIZE - 1", () => {
    expect(isFieldElement(0n)).toBe(true)
    expect(isFieldElement(FIELD_SIZE - 1n)).toBe(true)
  })

  test("rejects negatives and values >= FIELD_SIZE", () => {
    expect(isFieldElement(-1n)).toBe(false)
    expect(isFieldElement(FIELD_SIZE)).toBe(false)
  })
})

describe("generateSecret", () => {
  test("returns distinct field elements of at most 248 bits", () => {
    const secrets = Array.from({ length: 100 }, generateSecret)
    for (const secret of secrets) {
      expect(isFieldElement(secret)).toBe(true)
      expect(secret).toBeLessThan(1n << 248n)
    }
    expect(new Set(secrets).size).toBe(secrets.length)
  })
})
