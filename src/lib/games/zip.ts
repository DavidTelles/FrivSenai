import { unzipSync } from "fflate";
import { contentTypeFor, validateFileContent, validateGamePath } from "./file-rules";

export const ZIP_LIMITS = {
  archiveBytes: 100 * 1024 * 1024,
  totalBytes: 250 * 1024 * 1024,
  fileBytes: 50 * 1024 * 1024,
  files: 1000,
  depth: 10,
} as const;

export class ZipValidationError extends Error {}

export type ExtractedFile = { path: string; contentType: string; data: Uint8Array };
export type ExtractedGame = { entryPath: string; files: ExtractedFile[]; totalBytes: number };

const IGNORED = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$)/;
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export function extractGameZip(archive: Uint8Array): ExtractedGame {
  if (archive.length > ZIP_LIMITS.archiveBytes) {
    throw new ZipValidationError("The ZIP file exceeds the 100 MB limit.");
  }
  if (!ZIP_MAGIC.every((byte, index) => archive[index] === byte)) {
    throw new ZipValidationError("The uploaded file is not a valid ZIP archive.");
  }

  let declaredTotal = 0;
  let entryCount = 0;
  const violation: { message?: string } = {};
  const fail = (message: string) => {
    violation.message ??= message;
    return false;
  };

  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(archive, {
      filter: ({ name, originalSize }) => {
        if (name.endsWith("/") || IGNORED.test(name)) return false;
        entryCount += 1;
        if (entryCount > ZIP_LIMITS.files) return fail(`The ZIP contains more than ${ZIP_LIMITS.files} files.`);
        const pathError = validateGamePath(name, ZIP_LIMITS.depth);
        if (pathError) return fail(`"${name}": ${pathError}`);
        if (originalSize > ZIP_LIMITS.fileBytes) return fail(`"${name}" exceeds the 50 MB per-file limit.`);
        declaredTotal += originalSize;
        if (declaredTotal > ZIP_LIMITS.totalBytes) return fail("The extracted game exceeds the 250 MB limit.");
        return !violation.message;
      },
    });
  } catch {
    throw new ZipValidationError("The ZIP archive is corrupted or uses an unsupported format.");
  }
  if (violation.message) throw new ZipValidationError(violation.message);

  const names = Object.keys(raw);
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) throw new ZipValidationError(`"${name}" appears more than once in the ZIP.`);
    seen.add(key);
  }

  const entryPath = findEntry(names);
  const prefix = entryPath.slice(0, entryPath.length - "index.html".length);

  const files: ExtractedFile[] = [];
  let totalBytes = 0;
  for (const name of names) {
    if (!name.startsWith(prefix)) {
      throw new ZipValidationError(`"${name}" is outside the folder that contains index.html.`);
    }
    const data = raw[name];
    const contentError = validateFileContent(name, data);
    if (contentError) throw new ZipValidationError(`"${name}": ${contentError}`);
    totalBytes += data.length;
    files.push({ path: name.slice(prefix.length), contentType: contentTypeFor(name), data });
  }

  return { entryPath: "index.html", files, totalBytes };
}

function findEntry(names: string[]): string {
  const candidates = names.filter((name) => name.toLowerCase().split("/").pop() === "index.html" && name.endsWith("index.html"));
  if (candidates.length === 0) throw new ZipValidationError("No index.html was found in the ZIP.");
  const depthOf = (name: string) => name.split("/").length;
  const shallowest = Math.min(...candidates.map(depthOf));
  const top = candidates.filter((name) => depthOf(name) === shallowest);
  if (top.length > 1) {
    throw new ZipValidationError("More than one main index.html was found. Keep a single game per ZIP.");
  }
  return top[0];
}
