const DEFAULT_RATE_LIMIT_KEY = "anonymous";
const DEFAULT_TRUSTED_PROXY_HOPS = 1;
const MAX_TRUSTED_PROXY_HOPS = 10;

function shouldTrustProxyHeaders() {
  return process.env.RATE_LIMIT_TRUST_PROXY_HEADERS === "true";
}

function getTrustedProxyHops() {
  const parsed = Number.parseInt(
    process.env.RATE_LIMIT_TRUSTED_PROXY_HOPS ?? "",
    10,
  );

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }

  return Math.min(parsed, MAX_TRUSTED_PROXY_HOPS);
}

function readHeaderList(value: string | null) {
  return (
    value
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean) ?? []
  );
}

export function getClientIp(request: Request) {
  if (!shouldTrustProxyHeaders()) {
    return DEFAULT_RATE_LIMIT_KEY;
  }

  const forwardedFor = readHeaderList(request.headers.get("x-forwarded-for"));

  if (forwardedFor.length) {
    const trustedHopIndex = Math.max(
      forwardedFor.length - getTrustedProxyHops(),
      0,
    );

    return forwardedFor[trustedHopIndex] ?? DEFAULT_RATE_LIMIT_KEY;
  }

  return request.headers.get("x-real-ip")?.trim() || DEFAULT_RATE_LIMIT_KEY;
}
