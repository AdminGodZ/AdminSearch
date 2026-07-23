export type SearchTab = "all" | "images" | "videos" | "news";

export type SearchRequest = {
  cursor?: string;
  q: string;
  tab: SearchTab;
  page: number;
  language?: string;
  timeRange?: "day" | "month" | "year";
  safeSearch?: 0 | 1 | 2;
};

export type SearchResult = {
  id: string;
  kind: "web" | "image" | "video";
  title: string;
  url: string;
  displayUrl?: string;
  snippet?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  author?: string;
  duration?: string;
  publishedAt?: string;
  source?: string;
  engine?: string;
};

export type SearchInfobox = {
  id: string;
  title: string;
  content?: string;
  url?: string;
  source?: string;
  engine?: string;
  imageUrl?: string;
  attributes: SearchInfoboxAttribute[];
  urls: SearchInfoboxUrl[];
  relatedTopics: SearchInfoboxRelatedTopic[];
};

export type SearchInfoboxAttribute = {
  label: string;
  value?: string;
  image?: {
    src: string;
    alt?: string;
  };
};

export type SearchInfoboxUrl = {
  title: string;
  url: string;
  official?: boolean;
};

export type SearchInfoboxRelatedTopic = {
  name: string;
  suggestions: string[];
};

export type SearchResponse = {
  query: string;
  tab: SearchTab;
  page: number;
  totalResults?: number;
  requestDurationMs?: number;
  results: SearchResult[];
  suggestions: string[];
  answers: string[];
  infoboxes: SearchInfobox[];
  hasMore: boolean;
  nextPageCursor?: string;
};

export type SearxRawResult = Record<string, unknown>;

export type SearxResponse = {
  query?: string;
  number_of_results?: number;
  results?: SearxRawResult[];
  suggestions?: unknown[];
  answers?: unknown[];
  infoboxes?: unknown[];
};
