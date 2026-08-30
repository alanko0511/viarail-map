import { expect, it } from "vitest"

import { AllTrainDataSchema } from "@/server/schemas/train"

import fixtureData from "./fixtures/legacy-2026-04-04.json"

it("parses the real API fixture data", () => {
  const result = AllTrainDataSchema.parse(fixtureData)
  expect(Object.keys(result).length).toBeGreaterThan(0)
})
