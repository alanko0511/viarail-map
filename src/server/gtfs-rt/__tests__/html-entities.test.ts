import { describe, expect, it } from "vitest"

import { decodeEntities } from "@/server/gtfs-rt/html-entities"

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("Qu&eacute; &amp; &#233;t&#xE9;")).toBe(
      "Qu&eacute; & été"
    )
  })

  it("leaves an entity naming no character as written", () => {
    // Past U+10FFFF, String.fromCodePoint throws, and one bad advisory would
    // take down every feed.
    expect(decodeEntities("a &#99999999; b &#x110000; c")).toBe(
      "a &#99999999; b &#x110000; c"
    )
  })
})
