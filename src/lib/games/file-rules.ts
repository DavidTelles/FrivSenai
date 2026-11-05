type FileKind = "text" | "image" | "audio" | "font" | "wasm" | "video" | "data";

const FILE_TYPES: Record<string, { type: string; kind: FileKind }> = {
  html: { type: "text/html; charset=utf-8", kind: "text" },
  htm: { type: "text/html; charset=utf-8", kind: "text" },
  css: { type: "text/css; charset=utf-8", kind: "text" },
  js: { type: "text/javascript; charset=utf-8", kind: "text" },
  mjs: { type: "text/javascript; charset=utf-8", kind: "text" },
  json: { type: "application/json; charset=utf-8", kind: "text" },
  txt: { type: "text/plain; charset=utf-8", kind: "text" },
  xml: { type: "application/xml; charset=utf-8", kind: "text" },
  map: { type: "application/json; charset=utf-8", kind: "text" },
  svg: { type: "image/svg+xml", kind: "text" },
  png: { type: "image/png", kind: "image" },
  jpg: { type: "image/jpeg", kind: "image" },
  jpeg: { type: "image/jpeg", kind: "image" },
  gif: { type: "image/gif", kind: "image" },
  webp: { type: "image/webp", kind: "image" },
  ico: { type: "image/x-icon", kind: "image" },
  mp3: { type: "audio/mpeg", kind: "audio" },
  ogg: { type: "audio/ogg", kind: "audio" },
  wav: { type: "audio/wav", kind: "audio" },
  m4a: { type: "audio/mp4", kind: "audio" },
  mp4: { type: "video/mp4", kind: "video" },
  webm: { type: "video/webm", kind: "video" },
  woff: { type: "font/woff", kind: "font" },
  woff2: { type: "font/woff2", kind: "font" },
  ttf: { type: "font/ttf", kind: "font" },
  otf: { type: "font/otf", kind: "font" },
  wasm: { type: "application/wasm", kind: "wasm" },
  data: { type: "application/octet-stream", kind: "data" },
  pck: { type: "application/octet-stream", kind: "data" },
  bin: { type: "application/octet-stream", kind: "data" },
  mem: { type: "application/octet-stream", kind: "data" },
};

const SAFE_SEGMENT = /^[A-Za-z0-9 _.()@+-]+$/;

export function extensionOf(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function contentTypeFor(path: string): string {
  return FILE_TYPES[extensionOf(path)]?.type ?? "application/octet-stream";
}

export function validateGamePath(path: string, maxDepth: number): string | null {
  if (path.length === 0 || path.length > 512) return "the path length is invalid.";
  if (path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/.test(path)) return "the path must be relative.";
  const segments = path.split("/");
  if (segments.length > maxDepth) return `the path is nested deeper than ${maxDepth} levels.`;
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") return "the path contains a forbidden segment.";
    if (segment.startsWith(".") || segment.endsWith(".") || segment.endsWith(" ") || !SAFE_SEGMENT.test(segment)) {
      return "the path contains forbidden characters.";
    }
  }
  if (!FILE_TYPES[extensionOf(path)]) return "this file type is not supported.";
  return null;
}

const startsWith = (data: Uint8Array, bytes: number[], offset = 0) =>
  data.length >= offset + bytes.length && bytes.every((byte, index) => data[offset + index] === byte);
const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

function isExecutable(data: Uint8Array): boolean {
  return (
    startsWith(data, ascii("MZ")) ||
    startsWith(data, [0x7f, 0x45, 0x4c, 0x46]) ||
    startsWith(data, [0xfe, 0xed, 0xfa, 0xce]) ||
    startsWith(data, [0xfe, 0xed, 0xfa, 0xcf]) ||
    startsWith(data, [0xce, 0xfa, 0xed, 0xfe]) ||
    startsWith(data, [0xcf, 0xfa, 0xed, 0xfe]) ||
    startsWith(data, [0xca, 0xfe, 0xba, 0xbe]) ||
    startsWith(data, ascii("#!"))
  );
}

function isArchive(data: Uint8Array): boolean {
  return (
    startsWith(data, ascii("PK\x03\x04")) ||
    startsWith(data, [0x1f, 0x8b]) ||
    startsWith(data, ascii("Rar!")) ||
    startsWith(data, [0x37, 0x7a, 0xbc, 0xaf])
  );
}

const SIGNATURES: Record<string, (data: Uint8Array) => boolean> = {
  png: (d) => startsWith(d, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (d) => startsWith(d, [0xff, 0xd8, 0xff]),
  jpeg: (d) => startsWith(d, [0xff, 0xd8, 0xff]),
  gif: (d) => startsWith(d, ascii("GIF87a")) || startsWith(d, ascii("GIF89a")),
  webp: (d) => startsWith(d, ascii("RIFF")) && startsWith(d, ascii("WEBP"), 8),
  ico: (d) => startsWith(d, [0, 0, 1, 0]),
  mp3: (d) => startsWith(d, ascii("ID3")) || (d[0] === 0xff && (d[1] & 0xe0) === 0xe0),
  ogg: (d) => startsWith(d, ascii("OggS")),
  wav: (d) => startsWith(d, ascii("RIFF")) && startsWith(d, ascii("WAVE"), 8),
  m4a: (d) => startsWith(d, ascii("ftyp"), 4),
  mp4: (d) => startsWith(d, ascii("ftyp"), 4),
  webm: (d) => startsWith(d, [0x1a, 0x45, 0xdf, 0xa3]),
  woff: (d) => startsWith(d, ascii("wOFF")),
  woff2: (d) => startsWith(d, ascii("wOF2")),
  ttf: (d) => startsWith(d, [0, 1, 0, 0]) || startsWith(d, ascii("true")),
  otf: (d) => startsWith(d, ascii("OTTO")),
  wasm: (d) => startsWith(d, [0x00, 0x61, 0x73, 0x6d]),
};

function isUtf8Text(data: Uint8Array): boolean {
  if (data.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data);
    return true;
  } catch {
    return false;
  }
}

export function validateFileContent(path: string, data: Uint8Array): string | null {
  const extension = extensionOf(path);
  const rule = FILE_TYPES[extension];
  if (!rule) return "this file type is not supported.";
  if (isExecutable(data)) return "executable content is not allowed.";
  if (isArchive(data)) return "nested archives are not allowed.";
  if (rule.kind === "text") {
    return isUtf8Text(data) ? null : "the content does not match a UTF-8 text file.";
  }
  const signature = SIGNATURES[extension];
  if (signature && !signature(data)) return `the content does not match a real .${extension} file.`;
  return null;
}

const COVER_EXTENSIONS: [string, string, keyof typeof SIGNATURES][] = [
  ["png", "image/png", "png"],
  ["jpg", "image/jpeg", "jpg"],
  ["webp", "image/webp", "webp"],
  ["gif", "image/gif", "gif"],
];

export function detectCoverImage(data: Uint8Array): { extension: string; contentType: string } | null {
  for (const [extension, contentType, key] of COVER_EXTENSIONS) {
    if (SIGNATURES[key](data)) return { extension, contentType };
  }
  return null;
}
