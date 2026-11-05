import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sql } from "@/lib/db";
import { detectCoverImage } from "@/lib/games/file-rules";
import { makeGameSlug } from "@/lib/games/slug";
import { checkGameUrl } from "@/lib/games/url-check";
import { extractGameZip, ZIP_LIMITS, ZipValidationError, type ExtractedFile } from "@/lib/games/zip";
import type { PublishInput } from "@/lib/validation/game";

const COVER_MAX_BYTES = 5 * 1024 * 1024;
const DAILY_PUBLISH_LIMIT = 20;
const UPLOAD_CONCURRENCY = 8;

export const stagedPaths = (uploadId: string) => ({ cover: `${uploadId}/cover`, zip: `${uploadId}/game.zip` });

export class PublishError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function publisherKey(ip: string) {
  return createHash("sha256").update(ip).digest("hex");
}

export async function assertUnderDailyLimit(publisher: string) {
  const [{ count }] = await sql`select count(*)::int as count from public.games
    where publisher_key = ${publisher} and created_at >= now() - interval '1 day'`;
  if (count >= DAILY_PUBLISH_LIMIT) throw new PublishError("Daily publishing limit reached.", 429);
}

export async function createUploadSlot(admin: SupabaseClient, publisher: string, withZip: boolean) {
  await assertUnderDailyLimit(publisher);
  const uploadId = randomUUID();
  const paths = stagedPaths(uploadId);
  const sign = async (path: string) => {
    const { data, error } = await admin.storage.from("uploads").createSignedUploadUrl(path);
    if (error || !data) throw new PublishError("Uploads are unavailable right now.", 500);
    return { path, token: data.token };
  };
  return {
    uploadId,
    cover: await sign(paths.cover),
    zip: withZip ? await sign(paths.zip) : null,
  };
}

async function downloadStaged(admin: SupabaseClient, path: string, maxBytes: number, label: string) {
  const { data, error } = await admin.storage.from("uploads").download(path);
  if (error || !data) throw new PublishError(`The ${label} upload was not found. Please try again.`);
  if (data.size > maxBytes) throw new PublishError(`The ${label} is too large.`);
  return new Uint8Array(await data.arrayBuffer());
}

async function uploadFiles(admin: SupabaseClient, gameId: string, files: ExtractedFile[]) {
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      const { error } = await admin.storage
        .from("game-files")
        .upload(`${gameId}/${file.path}`, file.data, { contentType: file.contentType, upsert: false });
      if (error) throw new PublishError(`Could not store "${file.path}".`, 500);
    }
  };
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
}

async function removeGameStorage(admin: SupabaseClient, gameId: string, paths: string[]) {
  for (let index = 0; index < paths.length; index += 500) {
    await admin.storage.from("game-files").remove(paths.slice(index, index + 500).map((path) => `${gameId}/${path}`));
  }
  const { data } = await admin.storage.from("game-covers").list(gameId);
  if (data?.length) await admin.storage.from("game-covers").remove(data.map(({ name }) => `${gameId}/${name}`));
}

export async function publishGame(admin: SupabaseClient, publisher: string, input: PublishInput, appOrigin: string) {
  await assertUnderDailyLimit(publisher);
  const paths = stagedPaths(input.uploadId);
  const staged = [paths.cover, ...(input.sourceType === "zip" ? [paths.zip] : [])];

  const coverBytes = await downloadStaged(admin, paths.cover, COVER_MAX_BYTES, "cover image");
  const cover = detectCoverImage(coverBytes);
  if (!cover) throw new PublishError("The cover must be a real PNG, JPEG, WebP or GIF image.");

  const gameId = randomUUID();
  const source = { entry_path: null as string | null, external_url: null as string | null, embed_status: "embeddable" };
  let extracted: ExtractedFile[] = [];

  if (input.sourceType === "zip") {
    const archive = await downloadStaged(admin, paths.zip, ZIP_LIMITS.archiveBytes, "ZIP file");
    try {
      const game = extractGameZip(archive);
      extracted = game.files;
      source.entry_path = game.entryPath;
    } catch (error) {
      if (error instanceof ZipValidationError) throw new PublishError(error.message);
      throw error;
    }
  } else {
    const check = await checkGameUrl(input.url, appOrigin);
    if (!check.ok) throw new PublishError(check.error);
    source.external_url = check.finalUrl;
    source.embed_status = check.embedStatus;
  }

  const coverStoragePath = `${gameId}/${randomUUID()}.${cover.extension}`;
  const filePaths = extracted.map(({ path }) => path);
  try {
    const coverUpload = await admin.storage
      .from("game-covers")
      .upload(coverStoragePath, coverBytes, { contentType: cover.contentType });
    if (coverUpload.error) throw new PublishError("Could not store the cover image.", 500);
    await uploadFiles(admin, gameId, extracted);

    const coverUrl = admin.storage.from("game-covers").getPublicUrl(coverStoragePath).data.publicUrl;
    const slug = makeGameSlug(input.title);
    try {
      await sql.transaction([
        sql`insert into public.games (id, category_id, slug, title, description, developer_name, controls,
            technologies, cover_url, source_type, entry_path, external_url, embed_status, publisher_key)
          values (${gameId}, ${input.categoryId}, ${slug}, ${input.title}, ${input.description},
            ${input.developerName}, ${input.controls}, ${input.technologies}, ${coverUrl}, ${input.sourceType},
            ${source.entry_path}, ${source.external_url}, ${source.embed_status}, ${publisher})`,
        sql`insert into public.game_files (game_id, path, content_type, size_bytes)
          select ${gameId}, * from unnest(${extracted.map((file) => file.path)}::text[],
            ${extracted.map((file) => file.contentType)}::text[], ${extracted.map((file) => file.data.length)}::bigint[])`,
      ]);
    } catch {
      throw new PublishError("Could not save the game. Check the category and try again.");
    }
    await admin.storage.from("uploads").remove(staged);
    return { slug, embedStatus: source.embed_status };
  } catch (error) {
    await removeGameStorage(admin, gameId, filePaths);
    throw error;
  }
}
