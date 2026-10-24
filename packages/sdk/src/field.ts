import { FIELD_SIZE } from "./protocol"

/** True if `value` is a canonical BN254 field element (0 <= value < FIELD_SIZE). */
export function isFieldElement(value: bigint): boolean {
  return value >= 0n && value < FIELD_SIZE
}

/**
 * Returns a fresh allocation secret from a cryptographically secure source.
 *
 * Secrets carry the privacy: a recipient's Merkle path includes a neighbouring
 * commitment, so a guessable secret would let them brute-force that neighbour's
 * amount. 31 random bytes (248 bits) always fit below FIELD_SIZE.
 * Mirrors generateSecret() in circuits/lib/conservation.js.
 */
export function generateSecret(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(31))
  return bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n)
}
