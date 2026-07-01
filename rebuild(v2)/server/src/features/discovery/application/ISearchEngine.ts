export interface SearchQueryOptions {
  query: string;
  limit: number;
  cursor?: string;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResultPage<T> {
  items: T[];
  nextCursor?: string;
}

export interface ISearchEngine {
  searchUsers(options: SearchQueryOptions): Promise<SearchResultPage<any>>;
  searchCommunities(options: SearchQueryOptions, userId?: string): Promise<SearchResultPage<any>>;
  searchRooms(options: SearchQueryOptions, userId?: string): Promise<SearchResultPage<any>>;
  searchMessages(options: SearchQueryOptions, permittedRoomIds: string[]): Promise<SearchResultPage<any>>;
}
