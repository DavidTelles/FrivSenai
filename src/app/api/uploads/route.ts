import { NextResponse, type NextRequest } from "next/server";
import { clientIp, isSameOrigin, jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUploadSlot, PublishError, publisherKey } from "@/services/publish";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Forbidden.", 403);
  const body = await request.json().catch(() => null);
  try {
    const slot = await createUploadSlot(createAdminClient(), publisherKey(clientIp(request)), body?.zip === true);
    return NextResponse.json(slot, { status: 201 });
  } catch (error) {
    if (error instanceof PublishError) return jsonError(error.message, error.status);
    console.error("upload slot failed", error);
    return jsonError("Uploads are unavailable right now.", 500);
  }
}
