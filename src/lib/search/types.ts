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

export type SearchResponse = {
  query: string;
  tab: SearchTab;
  page: number;
  results: SearchResult[];
  suggestions: string[];
  answers: string[];
  infoboxes: unknown[];
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
