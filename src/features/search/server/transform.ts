import { DEFAULT_RESULTS_PER_PAGE } from "@/features/search/server/searx-client";
import type {
  SearchInfobox,
  SearchInfoboxAttribute,
  SearchInfoboxRelatedTopic,
  SearchInfoboxUrl,
  SearchRequest,
  SearchResponse,
  SearchResult,
  SearxRawResult,
  SearxResponse,
} from "@/features/search/types";

function readString(record: SearxRawResult, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return undefined;
}

function readSnippet(record: SearxRawResult) {
  const value = readString(record, ["content", "snippet", "description"]);

  return value === "-" ? undefined : value;
}

function readHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function readThumbnail(result: SearxRawResult) {
  return readString(result, [
    "thumbnail_src",
    "img_src",
    "thumbnail",
    "thumbnail_url",
    "img",
  ]);
}

function readPreviewUrl(result: SearxRawResult) {
  return readString(result, ["iframe_src"]);
}

function readPublishedAt(result: SearxRawResult) {
  return readString(result, ["publishedDate", "pubdate"]);
}

function normalizeResult(
  result: SearxRawResult,
  index: number,
  tab: SearchRequest["tab"],
): SearchResult | null {
  const url = readString(result, ["url", "img_src", "thumbnail_src"]);

  if (!url) {
    return null;
  }

  const hostname = readHostname(url);
  const title =
    readString(result, ["title", "pretty_url"]) ??
    hostname ??
    (tab === "images" ? "Untitled image" : "Untitled result");

  const thumbnailUrl = readThumbnail(result);
  const previewUrl = readPreviewUrl(result);
  const displayUrl =
    readString(result, ["pretty_url", "parsed_url"]) ?? hostname ?? url;
  const snippet = readSnippet(result);
  const engine = readString(result, ["engine"]);
  const author = readString(result, ["author"]);
  const duration = readString(result, ["length"]);
  const publishedAt = readPublishedAt(result);

  return {
    id: `${tab}-${index}-${encodeURIComponent(url)}`,
    kind: tab === "images" ? "image" : tab === "videos" ? "video" : "web",
    title,
    url,
    displayUrl,
    snippet,
    thumbnailUrl,
    previewUrl,
    author,
    duration,
    publishedAt,
    source: hostname,
    engine,
  };
}

function extractAnswers(rawAnswers: unknown[] | undefined) {
  if (!Array.isArray(rawAnswers)) {
    return [];
  }

  return rawAnswers.filter((item): item is string => typeof item === "string");
}

function extractSuggestions(rawSuggestions: unknown[] | undefined) {
  if (!Array.isArray(rawSuggestions)) {
    return [];
  }

  return rawSuggestions.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}

function extractString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function readInfoboxUrl(record: SearxRawResult) {
  const directUrl = extractString(record.url);

  if (directUrl) {
    return directUrl;
  }

  const urls = record.urls;

  if (!Array.isArray(urls)) {
    return undefined;
  }

  for (const entry of urls) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const nestedUrl = extractString((entry as SearxRawResult).url);

    if (nestedUrl) {
      return nestedUrl;
    }
  }

  return undefined;
}

function readInfoboxSource(record: SearxRawResult, url?: string) {
  const urls = record.urls;

  if (Array.isArray(urls)) {
    for (const entry of urls) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const title = extractString((entry as SearxRawResult).title);

      if (title) {
        return title;
      }
    }
  }

  return url ? readHostname(url) : undefined;
}

function readInfoboxContent(record: SearxRawResult) {
  const directContent = extractString(record.content);

  if (directContent) {
    return directContent;
  }

  const attributes = record.attributes;

  if (Array.isArray(attributes)) {
    const attributeValues = attributes
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return undefined;
        }

        const value = (entry as SearxRawResult).value;

        if (Array.isArray(value)) {
          return value
            .filter((part): part is string => typeof part === "string")
            .join(" ")
            .trim();
        }

        return extractString(value);
      })
      .filter((value): value is string => Boolean(value));

    if (attributeValues.length) {
      return attributeValues.slice(0, 3).join(" • ");
    }
  }

  return undefined;
}

function readInfoboxImage(record: SearxRawResult) {
  return readString(record, ["img_src", "thumbnail_src", "thumbnail", "img"]);
}

function normalizeInfoboxAttribute(
  attribute: unknown,
): SearchInfoboxAttribute | null {
  if (!attribute || typeof attribute !== "object") {
    return null;
  }

  const record = attribute as SearxRawResult;
  const label = extractString(record.label);

  if (!label) {
    return null;
  }

  const rawValue = record.value;
  const value = Array.isArray(rawValue)
    ? rawValue
        .filter((part): part is string => typeof part === "string")
        .join(" ")
        .trim() || undefined
    : extractString(rawValue);

  let image: SearchInfoboxAttribute["image"];
  const rawImage = record.image;

  if (rawImage && typeof rawImage === "object") {
    const imageRecord = rawImage as SearxRawResult;
    const src = extractString(imageRecord.src);

    if (src) {
      image = {
        src,
        alt: extractString(imageRecord.alt),
      };
    }
  }

  return {
    label,
    value,
    image,
  };
}

function extractInfoboxAttributes(rawAttributes: unknown) {
  if (!Array.isArray(rawAttributes)) {
    return [];
  }

  return rawAttributes
    .map((attribute) => normalizeInfoboxAttribute(attribute))
    .filter(
      (attribute): attribute is SearchInfoboxAttribute => attribute !== null,
    );
}

function normalizeInfoboxUrl(urlEntry: unknown): SearchInfoboxUrl | null {
  if (!urlEntry || typeof urlEntry !== "object") {
    return null;
  }

  const record = urlEntry as SearxRawResult;
  const url = extractString(record.url);
  const title = extractString(record.title);

  if (!url || !title) {
    return null;
  }

  return {
    title,
    url,
    official: record.official === true,
  };
}

function extractInfoboxUrls(rawUrls: unknown) {
  if (!Array.isArray(rawUrls)) {
    return [];
  }

  return rawUrls
    .map((urlEntry) => normalizeInfoboxUrl(urlEntry))
    .filter((urlEntry): urlEntry is SearchInfoboxUrl => urlEntry !== null);
}

function normalizeInfoboxRelatedTopic(
  relatedTopic: unknown,
): SearchInfoboxRelatedTopic | null {
  if (!relatedTopic || typeof relatedTopic !== "object") {
    return null;
  }

  const record = relatedTopic as SearxRawResult;
  const name = extractString(record.name);
  const rawSuggestions = record.suggestions;

  if (!name || !Array.isArray(rawSuggestions)) {
    return null;
  }

  const suggestions = rawSuggestions.filter(
    (suggestion): suggestion is string =>
      typeof suggestion === "string" && suggestion.trim() !== "",
  );

  if (!suggestions.length) {
    return null;
  }

  return {
    name,
    suggestions,
  };
}

function extractInfoboxRelatedTopics(rawRelatedTopics: unknown) {
  if (!Array.isArray(rawRelatedTopics)) {
    return [];
  }

  return rawRelatedTopics
    .map((topic) => normalizeInfoboxRelatedTopic(topic))
    .filter((topic): topic is SearchInfoboxRelatedTopic => topic !== null);
}

function normalizeInfobox(
  infobox: unknown,
  index: number,
): SearchInfobox | null {
  if (!infobox || typeof infobox !== "object") {
    return null;
  }

  const record = infobox as SearxRawResult;
  const url = readInfoboxUrl(record);
  const title =
    extractString(record.title) ??
    extractString(record.infobox) ??
    extractString(record.id) ??
    url ??
    `Instant answer ${index + 1}`;

  return {
    id: `infobox-${index}-${encodeURIComponent(title)}`,
    title,
    content: readInfoboxContent(record),
    url,
    source: readInfoboxSource(record, url),
    engine: extractString(record.engine),
    imageUrl: readInfoboxImage(record),
    attributes: extractInfoboxAttributes(record.attributes),
    urls: extractInfoboxUrls(record.urls),
    relatedTopics: extractInfoboxRelatedTopics(record.relatedTopics),
  };
}

function extractInfoboxes(rawInfoboxes: unknown[] | undefined) {
  if (!Array.isArray(rawInfoboxes)) {
    return [];
  }

  return rawInfoboxes
    .map((infobox, index) => normalizeInfobox(infobox, index))
    .filter((infobox): infobox is SearchInfobox => infobox !== null);
}

export function transformSearxResponse(
  payload: SearxResponse,
  request: SearchRequest,
  options?: {
    hasMore?: boolean;
    nextPageCursor?: string;
    resultsPerPage?: number;
  },
): SearchResponse {
  const results = Array.isArray(payload.results)
    ? payload.results
        .map((result, index) => normalizeResult(result, index, request.tab))
        .filter((result): result is SearchResult => result !== null)
    : [];

  const numberOfResults =
    typeof payload.number_of_results === "number"
      ? payload.number_of_results
      : undefined;

  const hasMore =
    options?.hasMore ??
    (numberOfResults !== undefined
      ? request.page * Math.max(results.length, 1) < numberOfResults
      : results.length >=
        (options?.resultsPerPage ?? DEFAULT_RESULTS_PER_PAGE));

  return {
    query: request.q,
    tab: request.tab,
    page: request.page,
    totalResults: numberOfResults,
    results,
    suggestions: extractSuggestions(payload.suggestions),
    answers: extractAnswers(payload.answers),
    infoboxes: extractInfoboxes(payload.infoboxes),
    hasMore,
    nextPageCursor: options?.nextPageCursor,
  };
}
