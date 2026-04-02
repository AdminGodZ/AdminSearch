export type SearchTab = "all" | "images";

export type SearchRequest = {
  q: string;
  tab: SearchTab;
  page: number;
  language?: string;
  timeRange?: "day" | "month" | "year";
  safeSearch?: 0 | 1 | 2;
};

export type SearchResult = {
  id: string;
  kind: "web" | "image";
  title: string;
  url: string;
  displayUrl?: string;
  snippet?: string;
  thumbnailUrl?: string;
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
};

export type SearchResponse = {
  query: string;
  tab: SearchTab;
  page: number;
  results: SearchResult[];
  suggestions: string[];
  answers: string[];
  infoboxes: SearchInfobox[];
  hasMore: boolean;
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
