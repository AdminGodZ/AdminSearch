import { NextResponse } from "next/server";

import { getSearxngUpdateStatus } from "@/features/maintenance/server/searxng-update-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await getSearxngUpdateStatus();
  const cacheControl =
    status.state === "unknown"
      ? "no-store"
      : "public, max-age=300, stale-while-revalidate=3600";

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": cacheControl,
    },
  });
}
