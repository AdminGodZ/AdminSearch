import { z } from "zod";

import type { SearchRequest } from "@/features/search/types";

const positiveInteger = z
  .number()
  .int()
  .positive("page must be a positive integer");

export const searchRequestSchema = z.object({
  q: z.string().trim().min(1, "q is required"),
  tab: z.enum(["all", "images", "videos", "news"]).default("all"),
  page: z
    .preprocess((value) => {
      if (value === undefined) {
        return 1;
      }

      return Number(value);
    }, positiveInteger)
    .default(1),
  language: z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed === "" || trimmed === "auto" ? undefined : trimmed;
  }, z.string().min(2).max(16).optional()),
  timeRange: z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    return value === "" || value === "any" ? undefined : value;
  }, z.enum(["day", "month", "year"]).optional()),
  safeSearch: z
    .preprocess(
      (value) => {
        if (value === undefined) {
          return 0;
        }

        return Number(value);
      },
      z.union([z.literal(0), z.literal(1), z.literal(2)]),
    )
    .default(0),
});

export function parseSearchRequest(
  searchParams: URLSearchParams,
): SearchRequest {
  return searchRequestSchema.parse(Object.fromEntries(searchParams.entries()));
}
