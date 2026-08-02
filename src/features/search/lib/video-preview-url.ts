type VideoPreviewProvider = "dailymotion" | "odysee" | "vimeo" | "youtube";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const DAILYMOTION_HOSTS = new Set([
  "dailymotion.com",
  "www.dailymotion.com",
  "geo.dailymotion.com",
]);

const VIMEO_HOSTS = new Set(["player.vimeo.com"]);
const ODYSEE_HOSTS = new Set(["odysee.com", "www.odysee.com"]);

function readPreviewProvider(url: URL): VideoPreviewProvider | undefined {
  if (url.protocol !== "https:") {
    return undefined;
  }

  const hostname = url.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(hostname) && url.pathname.startsWith("/embed/")) {
    return "youtube";
  }

  if (
    DAILYMOTION_HOSTS.has(hostname) &&
    (url.pathname.startsWith("/embed/video/") ||
      url.pathname === "/player.html")
  ) {
    return "dailymotion";
  }

  if (VIMEO_HOSTS.has(hostname) && url.pathname.startsWith("/video/")) {
    return "vimeo";
  }

  if (ODYSEE_HOSTS.has(hostname) && url.pathname.startsWith("/$/embed/")) {
    return "odysee";
  }

  return undefined;
}

export function normalizeVideoPreviewUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (!readPreviewProvider(url)) {
      return undefined;
    }

    url.hash = "";

    return url.toString();
  } catch {
    return undefined;
  }
}
