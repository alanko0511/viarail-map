import { expect, it } from "vitest"
import fixtureData from "./fixtures/all-train-data.json"
import { AllTrainDataSchema } from "@/server/schemas/train"

it("parses the real API fixture data", () => {
  const result = AllTrainDataSchema.parse(fixtureData)
  expect(Object.keys(result).length).toBeGreaterThan(0)
})
