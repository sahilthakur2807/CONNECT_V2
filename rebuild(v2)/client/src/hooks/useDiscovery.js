import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

// --- Standalone Queries ---

export const useSearchUsersQuery = (q, limit = 20) =>
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

export const useSearchRoomsQuery = (q, limit = 20) =>
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

export const useSearchCommunitiesQuery = (q, limit = 20) =>
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

export const useSearchMessagesQuery = (q, limit = 20) =>
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

export const useDiscoveryTrendingQuery = (limit = 10) =>
  useQuery({
    queryKey: ["discovery", "trending", limit],
    queryFn: async () => {
      const res = await apiClient.get(`/discovery/trending?limit=${limit}`);
      return res.data.data;
    },
  });

export const useDiscoveryRecommendationsQuery = (limit = 10) =>
  useQuery({
    queryKey: ["discovery", "recommendations", limit],
    queryFn: async () => {
      const res = await apiClient.get(
        `/discovery/recommendations?limit=${limit}`,
      );
      return res.data.data;
    },
  });

// --- Backward Compatible Wrapper Hook ---

export function useDiscovery() {
  return {
    useSearchUsersQuery,
    useSearchRoomsQuery,
    useSearchCommunitiesQuery,
    useSearchMessagesQuery,
    useDiscoveryTrendingQuery,
    useDiscoveryRecommendationsQuery,
  };
}
