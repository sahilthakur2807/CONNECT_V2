import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import type { Room } from './useRooms';
import type { User } from '@/store/slices/authSlice';
import type { Message } from './useMessages';

interface SearchResultPage<T> {
  items: T[];
  nextCursor?: string;
}

export function useDiscovery() {
  const useSearchUsersQuery = (q: string, limit = 20) =>
    useQuery<SearchResultPage<User>>({
      queryKey: ['search', 'users', q, limit],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: SearchResultPage<User> }>(
          `/search/users?q=${encodeURIComponent(q)}&limit=${limit}`
        );
        return res.data.data;
      },
      enabled: q.length >= 2,
    });

  const useSearchRoomsQuery = (q: string, limit = 20) =>
    useQuery<SearchResultPage<Room>>({
      queryKey: ['search', 'rooms', q, limit],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: SearchResultPage<Room> }>(
          `/search/rooms?q=${encodeURIComponent(q)}&limit=${limit}`
        );
        return res.data.data;
      },
      enabled: q.length >= 2,
    });

  const useSearchCommunitiesQuery = (q: string, limit = 20) =>
    useQuery<SearchResultPage<any>>({
      queryKey: ['search', 'communities', q, limit],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: SearchResultPage<any> }>(
          `/search/communities?q=${encodeURIComponent(q)}&limit=${limit}`
        );
        return res.data.data;
      },
      enabled: q.length >= 2,
    });

  const useSearchMessagesQuery = (q: string, limit = 20) =>
    useQuery<SearchResultPage<Message>>({
      queryKey: ['search', 'messages', q, limit],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: SearchResultPage<Message> }>(
          `/search/messages?q=${encodeURIComponent(q)}&limit=${limit}`
        );
        return res.data.data;
      },
      enabled: q.length >= 2,
    });

  const useDiscoveryTrendingQuery = (limit = 10) =>
    useQuery<{ rooms: Room[]; communities: any[] }>({
      queryKey: ['discovery', 'trending', limit],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: { rooms: Room[]; communities: any[] } }>(
          `/discovery/trending?limit=${limit}`
        );
        return res.data.data;
      },
    });

  const useDiscoveryRecommendationsQuery = (limit = 10) =>
    useQuery<any[]>({
      queryKey: ['discovery', 'recommendations', limit],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: any[] }>(
          `/discovery/recommendations?limit=${limit}`
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
