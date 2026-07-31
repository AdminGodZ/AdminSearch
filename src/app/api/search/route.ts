import { NextResponse } from "next/server";

import { executeSearch } from "@/features/search/server/search-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await executeSearch({
    searchParams: new URL(request.url).searchParams,
    requestHeaders: request.headers,
  });

  return NextResponse.json(result.payload, {
    status: result.status,
    headers: result.headers,
  });
}
