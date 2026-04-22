import { NextResponse } from "next/server";

import { getPersistedPreferences } from "@/features/settings/server/preferences";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_SEARXNG_URL = "http://127.0.0.1:8080";
const REQUEST_TIMEOUT_MS = 5_000;

function getSearxBaseUrl() {
  return (process.env.SEARXNG_INTERNAL_URL ?? DEFAULT_SEARXNG_URL).replace(
    /\/$/,
    "",
  );
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 1) {
    return NextResponse.json({ suggestions: [] });
  }

  const preferences = await getPersistedPreferences();
  const upstreamUrl = new URL("/autocompleter", getSearxBaseUrl());
  upstreamUrl.searchParams.set("q", query);
  upstreamUrl.searchParams.set(
    "autocomplete",
    preferences.settings.autocomplete,
  );

  let response: Response;

  try {
    response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-real-ip": "127.0.0.1",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }

  if (!response.ok) {
    return NextResponse.json({ suggestions: [] });
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return NextResponse.json({ suggestions: [] });
  }

  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = payload[1].filter(
    (value): value is string =>
      typeof value === "string" && value.trim() !== "",
  );

  return NextResponse.json({ suggestions });
}
