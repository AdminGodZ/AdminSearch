type ResultEngineMetadata = {
  engine?: string;
  engines?: readonly string[];
};

const ENGINE_PART_LABELS = new Map([
  ["cse", "CSE"],
  ["ddg", "DDG"],
  ["duckduckgo", "DuckDuckGo"],
  ["github", "GitHub"],
  ["wikidata", "Wikidata"],
  ["wikipedia", "Wikipedia"],
  ["wolframalpha", "WolframAlpha"],
  ["youtube", "YouTube"],
]);

export function getResultEngines(result: ResultEngineMetadata) {
  const engines: string[] = [];
  const seenEngines = new Set<string>();

  for (const rawEngine of [...(result.engines ?? []), result.engine]) {
    const engine = rawEngine?.trim();

    if (!engine) {
      continue;
    }

    const normalizedEngine = engine.toLowerCase();

    if (seenEngines.has(normalizedEngine)) {
      continue;
    }

    seenEngines.add(normalizedEngine);
    engines.push(engine);
  }

  return engines;
}

export function mergeResultEngines(
  ...results: readonly ResultEngineMetadata[]
) {
  return getResultEngines({
    engines: results.flatMap((result) => getResultEngines(result)),
  });
}

export function rankResultsByEngineConsensus<
  Result extends ResultEngineMetadata,
>(results: readonly Result[]) {
  return results
    .map((result, index) => ({
      engineCount: getResultEngines(result).length,
      index,
      result,
    }))
    .sort(
      (first, second) =>
        second.engineCount - first.engineCount || first.index - second.index,
    )
    .map(({ result }) => result);
}

export function formatEngineName(engine: string) {
  return engine
    .split(/[\s._-]+/u)
    .filter(Boolean)
    .map((part) => {
      const normalizedPart = part.toLowerCase();

      return (
        ENGINE_PART_LABELS.get(normalizedPart) ??
        normalizedPart.charAt(0).toUpperCase() + normalizedPart.slice(1)
      );
    })
    .join(" ");
}

export function formatResultEngineNames(result: ResultEngineMetadata) {
  return getResultEngines(result).map(formatEngineName).join(", ");
}
