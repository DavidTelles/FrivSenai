"use server";

import { z } from "zod";
import { recordView } from "@/services/games";

export async function countView(gameId: string, viewerKey: string) {
  if (!z.uuid().safeParse(gameId).success || typeof viewerKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(viewerKey)) return;
  await recordView(gameId, viewerKey).catch(() => undefined);
}
