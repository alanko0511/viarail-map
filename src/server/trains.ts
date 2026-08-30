import type { AllTrainData } from "@/server/schemas/train"
import { TrainSchema } from "@/server/schemas/train"

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
      `VIA Rail API error: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()
  return parseAllTrainData(data)
}

/**
 * Parses the upstream payload one train at a time, dropping any train that
 * fails validation instead of failing the whole feed. Upstream has changed
 * shape without notice before (April vs August 2026), and one malformed train
 * should not take the map down.
 */
export function parseAllTrainData(data: unknown): AllTrainData {
  if (typeof data !== "object" || data === null) {
    throw new Error("VIA Rail API returned a non-object payload")
  }

  const trains: AllTrainData = {}
  for (const [key, value] of Object.entries(data)) {
    const result = TrainSchema.safeParse(value)
    if (result.success) {
      trains[key] = result.data
    } else {
      console.warn(`Skipping unparseable train ${key}:`, result.error.message)
    }
  }
  return trains
}
