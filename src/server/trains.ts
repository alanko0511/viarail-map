import { createServerFn } from "@tanstack/react-start"

export const getTrainData = createServerFn({ method: "GET" }).handler(
  async () => {
    // TODO: implement actual data fetching
    return { trains: [] as Array<{ id: string; name: string }> }
  }
)
