import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { clientIp, isSameOrigin, jsonError, requestOrigin } from "@/lib/http";
import { publishSchema } from "@/lib/validation/game";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishGame, PublishError, publisherKey } from "@/services/publish";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Forbidden.", 403);
  const parsed = publishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid data.", 400);

  try {
    const result = await publishGame(createAdminClient(), publisherKey(clientIp(request)), parsed.data, requestOrigin(request));
    revalidatePath("/");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PublishError) return jsonError(error.message, error.status);
    console.error("publish failed", error);
    return jsonError("Publishing failed. Please try again.", 500);
  }
}
