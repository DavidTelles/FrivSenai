import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL } from "@/lib/env";
import { contentTypeFor, validateGamePath } from "@/lib/games/file-rules";
import { HOSTED_GAME_CSP, injectStorageShim } from "@/lib/games/sandbox";
import { sql } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const BASE_HEADERS = {
  "Content-Security-Policy": HOSTED_GAME_CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Access-Control-Allow-Origin": "*",
};

function notFound() {
  return new NextResponse("Not found", { status: 404, headers: { ...BASE_HEADERS, "Content-Type": "text/plain" } });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ gameId: string; path: string[] }> }) {
  const { gameId, path } = await context.params;
  const filePath = path.join("/");
  if (!UUID.test(gameId) || validateGamePath(filePath, 10)) return notFound();

  const games = await sql`select 1 from public.games where id = ${gameId} and source_type = 'zip' and status = 'published'`;
  if (!games.length) return notFound();

  const encoded = path.map(encodeURIComponent).join("/");
  const upstream = await fetch(`${SUPABASE_URL}/storage/v1/object/public/game-files/${gameId}/${encoded}`);
  if (!upstream.ok || !upstream.body) return notFound();

  const contentType = contentTypeFor(filePath);
  const headers = { ...BASE_HEADERS, "Content-Type": contentType, "Cache-Control": "public, max-age=300" };
  if (contentType.startsWith("text/html")) {
    return new NextResponse(injectStorageShim(await upstream.text()), { headers });
  }
  return new NextResponse(upstream.body, { headers });
}
