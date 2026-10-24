/*
 * Protocol constants from the shared spec (docs/architecture.md).
 * They mirror shield-contracts/circuits/lib; a mismatch on either side breaks proofs.
 */

/** BN254 scalar field modulus. Circuit arithmetic wraps around at this value. */
export const FIELD_SIZE =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n

/** Amounts are token base units, range-checked to 64 bits in-circuit. */
export const AMOUNT_BITS = 64
export const MAX_AMOUNT = (1n << 64n) - 1n

/** Batch ids are the vault's `u64`. */
export const MAX_BATCH_ID = (1n << 64n) - 1n

/** Depth of each batch's Merkle tree. Still marked "proposed" in the spec. */
export const TREE_DEPTH = 10

/** One leaf per allocation, so this is also the most recipients a batch can have. */
export const MAX_ALLOCATIONS = 2 ** TREE_DEPTH

/**
 * Nullifier domain tag: ASCII "shieldzk.nullifier" read as a big-endian integer.
 * Must equal NULLIFIER_DOMAIN in circuits/lib/nullifier.js and nullifier.circom.
 */
export const NULLIFIER_DOMAIN = 0x736869656c647a6b2e6e756c6c6966696572n
