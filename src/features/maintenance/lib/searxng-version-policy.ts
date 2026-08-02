const SUCCESS_CACHE_CONTROL =
  "public, max-age=300, stale-while-revalidate=3600";

export function getSearxngVersionCacheControl(
  state: "latest" | "outdated" | "unknown",
) {
  return state === "unknown" ? "no-store" : SUCCESS_CACHE_CONTROL;
}
