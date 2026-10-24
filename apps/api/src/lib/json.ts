/**
 * JSON replacer that writes bigints as decimal strings. Amounts (u64) and field
 * elements (254 bits) don't fit in a JS number, so the API sends them as strings,
 * the same encoding the circuit test vectors use.
 */
export function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value
}
