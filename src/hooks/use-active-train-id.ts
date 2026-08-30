import { useMatch } from "@tanstack/react-router"

export function useActiveTrainId(): string | undefined {
  const trainMatch = useMatch({
    from: "/_map/train/$trainId",
    shouldThrow: false,
  })
  return trainMatch?.params.trainId
}
