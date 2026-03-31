import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "adminsearch",
    searchBackendUrl:
      process.env.SEARXNG_INTERNAL_URL ?? "http://127.0.0.1:8080",
    redisConfigured: Boolean(process.env.RATE_LIMIT_REDIS_URL),
    timestamp: new Date().toISOString(),
  });
}
