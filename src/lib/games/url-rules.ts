export type EmbedStatus = "embeddable" | "blocked";

export type UrlCheckResult =
  | { ok: true; finalUrl: string; embedStatus: EmbedStatus; reason: string | null }
  | { ok: false; error: string };

type ParsedUrl = { ok: true; url: URL } | { ok: false; error: string };

const LOCAL_HOST = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/i;

export function parseGameUrl(input: string, appOrigin: string): ParsedUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, error: "Enter a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Only https:// URLs are accepted." };
  if (url.username || url.password) return { ok: false, error: "URLs with credentials are not allowed." };
  if (url.port && url.port !== "443") return { ok: false, error: "Only the default HTTPS port is allowed." };
  if (LOCAL_HOST.test(url.hostname) || !url.hostname.includes(".") && !url.hostname.includes(":")) {
    return { ok: false, error: "Internal or local addresses are not allowed." };
  }
  if (url.origin === appOrigin) return { ok: false, error: "URLs on FrivSenai itself are not allowed." };
  return { ok: true, url };
}

type HeaderBag = Record<string, string | string[] | undefined>;

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value.join(",") : value ?? "");

export function analyzeFramingHeaders(
  headers: HeaderBag,
  appOrigin: string,
): { embedStatus: EmbedStatus; reason: string | null } {
  const xfo = single(headers["x-frame-options"]).trim().toLowerCase();
  const ancestors = single(headers["content-security-policy"])
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.toLowerCase().startsWith("frame-ancestors"));

  if (ancestors) {
    const sources = ancestors.split(/\s+/).slice(1);
    const allowed = sources.some((source) => frameSourceMatches(source, appOrigin));
    return allowed
      ? { embedStatus: "embeddable", reason: null }
      : { embedStatus: "blocked", reason: "The site's Content-Security-Policy (frame-ancestors) forbids embedding." };
  }
  if (xfo === "deny" || xfo === "sameorigin") {
    return { embedStatus: "blocked", reason: `The site sends X-Frame-Options: ${xfo.toUpperCase()}.` };
  }
  return { embedStatus: "embeddable", reason: null };
}

function frameSourceMatches(source: string, appOrigin: string): boolean {
  if (source === "*") return true;
  const clean = source.replace(/\/$/, "").toLowerCase();
  const app = new URL(appOrigin);
  if (clean === "https:" || clean === `${app.protocol}`) return true;
  if (clean === appOrigin.toLowerCase()) return true;
  const wildcard = clean.match(/^https?:\/\/\*\.(.+)$/);
  return Boolean(wildcard && app.hostname.endsWith(`.${wildcard[1]}`));
}
