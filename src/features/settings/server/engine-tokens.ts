export function getConfiguredEngineTokens() {
  return (process.env.SEARXNG_ENGINE_TOKENS ?? "")
    .split(/[;,]/)
    .map((token) => token.trim())
    .filter(Boolean);
}
