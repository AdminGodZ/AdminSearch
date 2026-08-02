import { executeSearch } from "@/features/search/server/search-service";
import {
  createSearchJsonResponse,
  createSearchTiming,
  createSearchTimingHeaders,
} from "@/features/search/server/search-timing";
import { createClientClosedResponse } from "@/server/upstream-fetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const timing = createSearchTiming();

  if (request.signal.aborted) {
    return createClientClosedResponse();
  }

  try {
    const result = await executeSearch({
      searchParams: new URL(request.url).searchParams,
      requestHeaders: request.headers,
      signal: request.signal,
      timing,
    });

    return createSearchJsonResponse({
      headers: result.headers,
      payload: result.payload,
      status: result.status,
      timing,
    });
  } catch (error) {
    if (request.signal.aborted) {
      return createClientClosedResponse(
        createSearchTimingHeaders(undefined, timing),
      );
    }

    throw error;
  }
}
