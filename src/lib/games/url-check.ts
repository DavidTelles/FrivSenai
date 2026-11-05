import "server-only";
import { lookup as dnsLookup } from "node:dns";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import type { IncomingHttpHeaders } from "node:http";
import { analyzeFramingHeaders, parseGameUrl, type UrlCheckResult } from "./url-rules";

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 6000;

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family !== 6) return false;
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return !blocked.check(mapped[1], "ipv4");
  const mappedHex = address.toLowerCase().match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return !blocked.check(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`, "ipv4");
  }
  return !blocked.check(address, "ipv6");
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void;

function safeLookup(hostname: string, options: { all?: boolean }, callback: LookupCallback) {
  dnsLookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, "");
    if (addresses.length === 0 || !addresses.every(({ address }) => isPublicAddress(address))) {
      return callback(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }), "");
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

function fetchHeaders(url: URL): Promise<{ status: number; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        lookup: safeLookup as never,
        timeout: TIMEOUT_MS,
        headers: { "user-agent": "FrivSenai-EmbedCheck/1.0", accept: "text/html,*/*" },
      },
      (res) => {
        resolve({ status: res.statusCode ?? 0, headers: res.headers });
        res.destroy();
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function checkGameUrl(input: string, appOrigin: string): Promise<UrlCheckResult> {
  const parsed = parseGameUrl(input, appOrigin);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  let current = parsed.url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const hostname = current.hostname.replace(/^\[|\]$/g, "");
    if (isIP(hostname) && !isPublicAddress(hostname)) {
      return { ok: false, error: "Internal or local addresses are not allowed." };
    }
    let response: Awaited<ReturnType<typeof fetchHeaders>>;
    try {
      response = await fetchHeaders(current);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return {
        ok: false,
        error: code === "EBLOCKED" ? "Internal or local addresses are not allowed." : "The URL could not be reached.",
      };
    }
    const location = response.headers.location;
    if (response.status >= 300 && response.status < 400 && location) {
      const next = parseGameUrl(new URL(location, current).toString(), appOrigin);
      if (!next.ok) return { ok: false, error: `The URL redirects to a forbidden address: ${next.error}` };
      current = next.url;
      continue;
    }
    if (response.status >= 400) {
      return { ok: false, error: `The URL responded with HTTP ${response.status}.` };
    }
    return { ok: true, finalUrl: current.toString(), ...analyzeFramingHeaders(response.headers, appOrigin) };
  }
  return { ok: false, error: "The URL redirects too many times." };
}
