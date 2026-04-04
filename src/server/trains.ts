import { createServerFn } from "@tanstack/react-start"
import * as z from "zod"
import type { AllTrainData } from "@/server/schemas/train"
import { AllTrainDataSchema } from "@/server/schemas/train"
import { transformTrainData } from "@/server/transform-train-data"

const VIARAIL_API_URL = "https://tsimobile.viarail.ca/data/allData.json"

export async function fetchAllTrainData(): Promise<AllTrainData> {
  const response = await fetch(VIARAIL_API_URL, {
    headers: {
      // The API is behind AWS Cloudfront and blocks requests when no user-agent is provided, so we need to provide a fake one.
      // I'm using the one I saw in the browser's developer tools to make it look like a real browser request.
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    },
  })

  if (!response.ok) {
    throw new Error(
      `VIA Rail API error: ${response.status} ${response.statusText}`,
    )
  }

  const data = await response.json()
  return AllTrainDataSchema.parse(data)
}

export const getTrainData = createServerFn({ method: "GET" })
  .inputValidator(z.object({ timeZone: z.string() }))
  .handler(async ({ data: { timeZone } }) => {
    const raw = await fetchAllTrainData()
    return transformTrainData(raw, timeZone)
  })
