import { NextResponse } from "next/server";

import { executeSearch } from "@/features/search/server/search-service";
import { createClientClosedResponse } from "@/server/upstream-fetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (request.signal.aborted) {
    return createClientClosedResponse();
  }

  try {
    const result = await executeSearch({
      searchParams: new URL(request.url).searchParams,
      requestHeaders: request.headers,
      signal: request.signal,
    });

    return NextResponse.json(result.payload, {
      status: result.status,
      headers: result.headers,
    });
  } catch (error) {
    if (request.signal.aborted) {
      return createClientClosedResponse();
    }

    throw error;
  }
}
