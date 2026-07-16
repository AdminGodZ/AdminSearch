const DEFAULT_SEARXNG_URL = "http://127.0.0.1:8080";
const DOCKER_AUTH_URL =
  "https://auth.docker.io/token?service=registry.docker.io&scope=repository:searxng/searxng:pull";
const DOCKER_REGISTRY_URL = "https://registry-1.docker.io/v2/searxng/searxng";
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILED_CHECK_CACHE_TTL_MS = 15 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 5000;

const DIGEST_PATTERN = /sha256:[a-f0-9]{64}/i;
const INDEX_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");
const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

export type SearxngUpdateState = "latest" | "outdated" | "unknown";

export type SearxngUpdateStatus = {
  checkedAt: string;
  currentVersion: string | null;
  latestDigest: string | null;
  latestVersion: string | null;
  state: SearxngUpdateState;
};

type DockerTokenResponse = {
  access_token?: unknown;
  token?: unknown;
};

type DockerIndex = {
  config?: {
    digest?: unknown;
  };
  manifests?: Array<{
    digest?: unknown;
    platform?: {
      architecture?: unknown;
      os?: unknown;
      variant?: unknown;
    };
  }>;
};

type DockerImageConfig = {
  config?: {
    Labels?: Record<string, unknown>;
  };
};

type SearxngConfig = {
  version?: unknown;
};

let cachedStatus:
  | {
      expiresAt: number;
      value: SearxngUpdateStatus;
    }
  | undefined;
let pendingStatus: Promise<SearxngUpdateStatus> | undefined;

export async function getSearxngUpdateStatus() {
  const now = Date.now();

  if (cachedStatus && cachedStatus.expiresAt > now) {
    return cachedStatus.value;
  }

  if (!pendingStatus) {
    pendingStatus = readSearxngUpdateStatus().finally(() => {
      pendingStatus = undefined;
    });
  }

  const value = await pendingStatus;
  cachedStatus = {
    expiresAt:
      Date.now() +
      (value.state === "unknown"
        ? FAILED_CHECK_CACHE_TTL_MS
        : getCacheTtlMs()),
    value,
  };

  return value;
}

async function readSearxngUpdateStatus(): Promise<SearxngUpdateStatus> {
  const [current, upstream] = await Promise.allSettled([
    readCurrentSearxngVersion(),
    readLatestSearxngImage(),
  ]);

  const currentVersion =
    current.status === "fulfilled" ? current.value.currentVersion : null;
  const latestDigest =
    upstream.status === "fulfilled" ? upstream.value.latestDigest : null;
  const latestVersion =
    upstream.status === "fulfilled" ? upstream.value.latestVersion : null;

  return {
    checkedAt: new Date().toISOString(),
    currentVersion,
    latestDigest,
    latestVersion,
    state: getUpdateState({
      currentVersion,
      latestVersion,
    }),
  };
}

async function readCurrentSearxngVersion() {
  const config = await fetchJson<SearxngConfig>(
    `${getSearxngBaseUrl()}/config`,
  );

  return {
    currentVersion:
      typeof config.version === "string" && config.version.trim()
        ? config.version.trim()
        : null,
  };
}

async function readLatestSearxngImage() {
  const tokenResponse = await fetchJson<DockerTokenResponse>(DOCKER_AUTH_URL);
  const token =
    typeof tokenResponse.token === "string"
      ? tokenResponse.token
      : typeof tokenResponse.access_token === "string"
        ? tokenResponse.access_token
        : null;

  if (!token) {
    throw new Error("Docker registry token response did not include a token");
  }

  const indexResponse = await fetchWithTimeout(
    `${DOCKER_REGISTRY_URL}/manifests/latest`,
    {
      headers: {
        Accept: INDEX_ACCEPT,
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const latestDigest = normalizeDigest(
    indexResponse.headers.get("docker-content-digest"),
  );

  if (!indexResponse.ok) {
    throw new Error(`Docker manifest request failed: ${indexResponse.status}`);
  }

  const index = (await indexResponse.json()) as DockerIndex;
  const manifest = await readPlatformManifest(index, token);
  const configDigest =
    typeof manifest.config?.digest === "string" ? manifest.config.digest : null;
  const latestVersion = configDigest
    ? await readImageVersionLabel(configDigest, token)
    : null;

  return {
    latestDigest,
    latestVersion,
  };
}

async function readPlatformManifest(index: DockerIndex, token: string) {
  if (!Array.isArray(index.manifests)) {
    return index;
  }

  const platformDigest = index.manifests.find((manifest) => {
    const platform = manifest.platform;

    return (
      typeof manifest.digest === "string" &&
      platform?.os === "linux" &&
      platform.architecture === "amd64"
    );
  })?.digest;

  if (!platformDigest) {
    throw new Error("Docker manifest list did not include linux/amd64");
  }

  return fetchJson<DockerIndex>(
    `${DOCKER_REGISTRY_URL}/manifests/${platformDigest}`,
    {
      headers: {
        Accept: MANIFEST_ACCEPT,
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

async function readImageVersionLabel(configDigest: string, token: string) {
  const config = await fetchJson<DockerImageConfig>(
    `${DOCKER_REGISTRY_URL}/blobs/${configDigest}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const version = config.config?.Labels?.["org.opencontainers.image.version"];

  return typeof version === "string" && version.trim() ? version.trim() : null;
}

async function fetchJson<T>(input: string, init?: RequestInit) {
  const response = await fetchWithTimeout(input, init);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchWithTimeout(input: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getFetchTimeoutMs());

  try {
    return await fetch(input, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getUpdateState({
  currentVersion,
  latestVersion,
}: {
  currentVersion: string | null;
  latestVersion: string | null;
}): SearxngUpdateState {
  const normalizedCurrentVersion = normalizeVersion(currentVersion);
  const normalizedLatestVersion = normalizeVersion(latestVersion);

  if (normalizedCurrentVersion && normalizedLatestVersion) {
    return normalizedCurrentVersion === normalizedLatestVersion
      ? "latest"
      : "outdated";
  }

  return "unknown";
}

function normalizeDigest(value: string | null | undefined) {
  const match = value?.match(DIGEST_PATTERN);

  return match?.[0].toLowerCase() ?? null;
}

function normalizeVersion(value: string | null | undefined) {
  return value
    ?.trim()
    .replace(/\+([a-f0-9]{7,40})$/i, "-$1")
    .toLowerCase();
}

function getSearxngBaseUrl() {
  return (process.env.SEARXNG_INTERNAL_URL ?? DEFAULT_SEARXNG_URL).replace(
    /\/+$/,
    "",
  );
}

function getCacheTtlMs() {
  return getPositiveIntegerEnv(
    "SEARXNG_UPDATE_CHECK_TTL_MS",
    DEFAULT_CACHE_TTL_MS,
  );
}

function getFetchTimeoutMs() {
  return getPositiveIntegerEnv(
    "SEARXNG_UPDATE_CHECK_TIMEOUT_MS",
    DEFAULT_FETCH_TIMEOUT_MS,
  );
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
