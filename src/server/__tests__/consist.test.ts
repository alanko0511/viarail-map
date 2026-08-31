import { describe, expect, it, vi } from "vitest"

import { parseConsist } from "@/server/consist"

import consist from "../../lib/__tests__/fixtures/consist-train-40.json"

// Every case here logs a warning by design, so the console stays quiet.
vi.spyOn(console, "warn").mockImplementation(() => {})

describe("parseConsist", () => {
  it("reads a consist and caches it", () => {
    const result = parseConsist(consist, "40")

    expect(result.value?.carriages).toHaveLength(5)
    expect(result.cacheable).toBe(true)
  })

  it("caches a service upstream refuses to quote", () => {
    // Real body for an origin/destination pair that is not on the service.
    const result = parseConsist(
      { error: { code: 7002, message: "Requested station not found" } },
      "60"
    )

    expect(result.value).toBeNull()
    // Asking again tomorrow gets the same answer, so it is worth holding.
    expect(result.cacheable).toBe(true)
  })

  it("caches a rejected request", () => {
    const result = parseConsist({ errors: ["Missing train number"] }, "")

    expect(result.value).toBeNull()
    expect(result.cacheable).toBe(true)
  })

  it("does not cache a payload it cannot read", () => {
    // A shape change upstream. Holding this for the TTL would blank the badge
    // long after a fix landed, so it goes unheld.
    const result = parseConsist({ unexpected: "shape" }, "40")

    expect(result.value).toBeNull()
    expect(result.cacheable).toBe(false)
  })
})
