import { describe, expect, test } from "bun:test"

import { loadConfig } from "./env"

const MONGODB_URI = "mongodb://localhost:27017/shieldzk"

describe("loadConfig", () => {
  test("applies defaults", () => {
    expect(loadConfig({ MONGODB_URI })).toEqual({
      NODE_ENV: "development",
      PORT: 4000,
      LOG_LEVEL: "info",
      MONGODB_URI,
      CORS_ORIGINS: ["http://localhost:5173"],
    })
  })

  test("parses PORT and a comma-separated CORS_ORIGINS", () => {
    const config = loadConfig({
      MONGODB_URI,
      PORT: "8080",
      CORS_ORIGINS: "https://a.example, https://b.example",
    })
    expect(config.PORT).toBe(8080)
    expect(config.CORS_ORIGINS).toEqual([
      "https://a.example",
      "https://b.example",
    ])
  })

  test("accepts multi-host replica set URIs", () => {
    const uri = "mongodb://a:27017,b:27017/shieldzk?replicaSet=rs0"
    expect(loadConfig({ MONGODB_URI: uri }).MONGODB_URI).toBe(uri)
  })

  test("rejects a missing or non-MongoDB URI", () => {
    expect(() => loadConfig({})).toThrow(/MONGODB_URI/)
    expect(() => loadConfig({ MONGODB_URI: "postgres://x" })).toThrow(
      /MONGODB_URI/
    )
  })

  test("rejects invalid values", () => {
    expect(() => loadConfig({ MONGODB_URI, PORT: "0" })).toThrow(/PORT/)
    expect(() => loadConfig({ MONGODB_URI, CORS_ORIGINS: "nope" })).toThrow(
      /CORS_ORIGINS/
    )
  })
})
