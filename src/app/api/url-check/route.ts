import { NextResponse, type NextRequest } from "next/server";
import { checkGameUrl } from "@/lib/games/url-check";
import { isSameOrigin, jsonError, requestOrigin } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Forbidden.", 403);
  const body = await request.json().catch(() => null);
  if (typeof body?.url !== "string" || body.url.length > 2000) return jsonError("Enter a valid URL.", 400);
  return NextResponse.json(await checkGameUrl(body.url, requestOrigin(request)));
}
