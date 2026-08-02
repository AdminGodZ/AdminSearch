import { NextResponse } from "next/server";

import { getSearxngVersionCacheControl } from "@/features/maintenance/lib/searxng-version-policy";
import { getSearxngUpdateStatus } from "@/features/maintenance/server/searxng-update-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await getSearxngUpdateStatus();

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": getSearxngVersionCacheControl(status.state),
    },
  });
}
