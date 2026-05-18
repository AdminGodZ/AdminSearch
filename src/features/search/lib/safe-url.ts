const SAFE_WEB_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeWebUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (!SAFE_WEB_PROTOCOLS.has(url.protocol)) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}
