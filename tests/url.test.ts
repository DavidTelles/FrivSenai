import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { checkGameUrl, isPublicAddress } = await import("@/lib/games/url-check");
const { analyzeFramingHeaders, parseGameUrl } = await import("@/lib/games/url-rules");

const APP = "https://frivsenai.test";

describe("parseGameUrl", () => {
  it.each(["http://example.com", "javascript:alert(1)", "file:///etc/passwd", "ftp://a.com", "data:text/html,x"])(
    "rejects protocol %s",
    (url) => expect(parseGameUrl(url, APP).ok).toBe(false),
  );
  it.each(["https://u:p@example.com", "https://example.com:8443", "https://localhost", "https://intranet", "https://db.internal", "https://frivsenai.test/x", "not a url"])(
    "rejects %s",
    (url) => expect(parseGameUrl(url, APP).ok).toBe(false),
  );
  it("accepts a public https URL", () => expect(parseGameUrl("https://example.com/game", APP).ok).toBe(true));
});

describe("isPublicAddress", () => {
  it.each(["127.0.0.1", "10.1.1.1", "172.16.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "not-ip"])(
    "blocks %s",
    (address) => expect(isPublicAddress(address)).toBe(false),
  );
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows %s", (address) =>
    expect(isPublicAddress(address)).toBe(true),
  );
});

describe("checkGameUrl SSRF", () => {
  it.each([
    "https://127.0.0.1/",
    "https://2130706433/",
    "https://0x7f.0.0.1/",
    "https://0177.0.0.1/",
    "https://[::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://169.254.169.254/latest/meta-data/",
  ])("blocks %s without connecting", async (url) => {
    const result = await checkGameUrl(url, APP);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/Internal or local|Internal/) });
  });
});

describe("analyzeFramingHeaders", () => {
  it("allows without restrictions", () => expect(analyzeFramingHeaders({}, APP).embedStatus).toBe("embeddable"));
  it("blocks XFO DENY", () => expect(analyzeFramingHeaders({ "x-frame-options": "DENY" }, APP).embedStatus).toBe("blocked"));
  it("blocks SAMEORIGIN", () => expect(analyzeFramingHeaders({ "x-frame-options": "sameorigin" }, APP).embedStatus).toBe("blocked"));
  it("blocks frame-ancestors none", () =>
    expect(analyzeFramingHeaders({ "content-security-policy": "default-src 'self'; frame-ancestors 'none'" }, APP).embedStatus).toBe("blocked"));
  it("allows listed ancestor even with XFO", () =>
    expect(analyzeFramingHeaders({ "content-security-policy": `frame-ancestors ${APP}`, "x-frame-options": "DENY" }, APP).embedStatus).toBe("embeddable"));
  it("allows wildcard", () =>
    expect(analyzeFramingHeaders({ "content-security-policy": "frame-ancestors *" }, APP).embedStatus).toBe("embeddable"));
});
