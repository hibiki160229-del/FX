import { fetchUsdJpyOhlcv } from "@/lib/data/fetch-ohlcv";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "1mo";
  const interval = searchParams.get("interval") ?? "1h";
  const payload = await fetchUsdJpyOhlcv(range, interval);
  return NextResponse.json(payload);
}
