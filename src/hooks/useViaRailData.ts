import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export const useViaRailData = () => {
  return useQuery({
    queryKey: ["via-rail-data"],
    queryFn: async () => {
      const response = await api.trainData.$get();
      const { data } = await response.json();
      return data;
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 10,
  });
};
