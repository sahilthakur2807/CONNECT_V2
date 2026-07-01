import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

export function useDiscovery() {
  const useSearchUsersQuery = (q, limit = 20) =>
    useQuery({
      queryKey: ["search", "users", q, limit],
      queryFn: async () => {
        const res = await apiClient.get(
          `/search/users?q=${encodeURIComponent(q)}&limit=${limit}`,
        );
        return res.data.data;
      },
      enabled: q.length >= 2,
    });

  const useSearchRoomsQuery = (q, limit = 20) =>
    useQuery({
      queryKey: ["search", "rooms", q, limit],
      queryFn: async () => {
        const res = await apiClient.get(
          `/search/rooms?q=${encodeURIComponent(q)}&limit=${limit}`,
        );
        return res.data.data;
      },
      enabled: q.length >= 2,
    });

  const useSearchCommunitiesQuery = (q, limit = 20) =>
    useQuery({
      queryKey: ["search", "communities", q, limit],
      queryFn: async () => {
        const res = await apiClient.get(
          `/search/communities?q=${encodeURIComponent(q)}&limit=${limit}`,
        );
        return res.data.data;
      },
      enabled: q.length >= 2,
    });

  const useSearchMessagesQuery = (q, limit = 20) =>
    useQuery({
      queryKey: ["search", "messages", q, limit],
      queryFn: async () => {
        const res = await apiClient.get(
          `/search/messages?q=${encodeURIComponent(q)}&limit=${limit}`,
        );
        return res.data.data;
      },
      enabled: q.length >= 2,
    });

  const useDiscoveryTrendingQuery = (limit = 10) =>
    useQuery({
      queryKey: ["discovery", "trending", limit],
      queryFn: async () => {
        const res = await apiClient.get(`/discovery/trending?limit=${limit}`);
        return res.data.data;
      },
    });

  const useDiscoveryRecommendationsQuery = (limit = 10) =>
    useQuery({
      queryKey: ["discovery", "recommendations", limit],
      queryFn: async () => {
        const res = await apiClient.get(
          `/discovery/recommendations?limit=${limit}`,
        );
        return res.data.data;
      },
    });

  return {
    useSearchUsersQuery,
    useSearchRoomsQuery,
    useSearchCommunitiesQuery,
    useSearchMessagesQuery,
    useDiscoveryTrendingQuery,
    useDiscoveryRecommendationsQuery,
  };
}
