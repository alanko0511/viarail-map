import { expect, it } from "vitest"

import { AllTrainDataSchema } from "@/server/schemas/train"

import fixtureData from "./fixtures/all-train-data.json"

it("parses the real API fixture data", () => {
  const result = AllTrainDataSchema.parse(fixtureData)
  expect(Object.keys(result).length).toBeGreaterThan(0)
})
