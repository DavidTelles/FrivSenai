import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractGameZip, ZipValidationError } from "@/lib/games/zip";

const html = strToU8("<!doctype html><title>x</title>");
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

const rejects = (files: Record<string, Uint8Array>, message: RegExp) =>
  expect(() => extractGameZip(zipSync(files))).toThrow(message);

describe("extractGameZip", () => {
  it("accepts a root game", () => {
    const game = extractGameZip(zipSync({ "index.html": html, "a/b.png": png, "s.js": strToU8("1") }));
    expect(game.entryPath).toBe("index.html");
    expect(game.files.map((f) => f.path).sort()).toEqual(["a/b.png", "index.html", "s.js"]);
  });

  it("strips the single top folder and ignores macOS junk", () => {
    const game = extractGameZip(zipSync({ "my-game/index.html": html, "my-game/s.css": strToU8("a{}"), "__MACOSX/x.js": strToU8("1") }));
    expect(game.files.map((f) => f.path).sort()).toEqual(["index.html", "s.css"]);
  });

  it("rejects non-zip bytes", () => {
    expect(() => extractGameZip(strToU8("not a zip"))).toThrow(ZipValidationError);
  });
  it("rejects missing index.html", () => rejects({ "a.js": strToU8("1") }, /No index.html/));
  it("rejects two main entries", () => rejects({ "a/index.html": html, "b/index.html": html }, /More than one/));
  it("rejects path traversal", () => rejects({ "index.html": html, "../evil.js": strToU8("1") }, /forbidden segment/));
  it("rejects nested traversal", () => rejects({ "index.html": html, "a/../../evil.js": strToU8("1") }, /forbidden segment/));
  it("rejects absolute paths", () => rejects({ "index.html": html, "/etc/x.js": strToU8("1") }, /relative/));
  it("rejects backslash paths", () => rejects({ "index.html": html, "..\\evil.js": strToU8("1") }, /relative/));
  it("rejects hidden files", () => rejects({ "index.html": html, ".env.js": strToU8("1") }, /forbidden characters/));
  it("rejects unsupported extensions", () => rejects({ "index.html": html, "run.exe": strToU8("x") }, /not supported/));
  it("rejects shell scripts", () => rejects({ "index.html": html, "run.sh": strToU8("x") }, /not supported/));
  it("rejects excessive depth", () => rejects({ "index.html": html, "a/b/c/d/e/f/g/h/i/j/k.js": strToU8("1") }, /deeper/));
  it("rejects executables disguised by extension", () =>
    rejects({ "index.html": html, "x.bin": new Uint8Array([0x4d, 0x5a, 0, 0]) }, /executable/));
  it("rejects ELF disguised as data", () =>
    rejects({ "index.html": html, "x.data": new Uint8Array([0x7f, 0x45, 0x4c, 0x46]) }, /executable/));
  it("rejects shebang scripts disguised as js", () =>
    rejects({ "index.html": html, "x.js": strToU8("#!/bin/sh\nrm") }, /executable/));
  it("rejects fake images", () => rejects({ "index.html": html, "x.png": strToU8("<script>") }, /real \.png/));
  it("rejects binary html", () => rejects({ "index.html": new Uint8Array([60, 0, 255]) }, /UTF-8/));
  it("rejects nested archives", () =>
    rejects({ "index.html": html, "x.data": zipSync({ "a.txt": strToU8("a") }) }, /nested archives/));
  it("rejects files outside the entry folder", () =>
    rejects({ "game/index.html": html, "other.js": strToU8("1") }, /outside/));
  it("rejects too many files", () => {
    const files: Record<string, Uint8Array> = { "index.html": html };
    for (let i = 0; i < 1001; i += 1) files[`f${i}.js`] = strToU8("1");
    rejects(files, /more than 1000/);
  });

  it("rejects a compressed bomb by declared size", () => {
    rejects({ "index.html": html, "big.data": new Uint8Array(51 * 1024 * 1024) }, /50 MB/);
  });

  it("does not inflate past a falsified declared size", () => {
    const archive = zipSync({ "index.html": html, "big.data": new Uint8Array(1024 * 1024).fill(7) }, { level: 9 });
    const view = new DataView(archive.buffer);
    for (let at = archive.length - 22; at > 0; at -= 1) {
      if (view.getUint32(at, true) === 0x02014b50 && new TextDecoder().decode(archive.subarray(at + 46, at + 46 + view.getUint16(at + 28, true))) === "big.data") {
        view.setUint32(at + 24, 10, true);
        break;
      }
    }
    let total = 0;
    try {
      total = extractGameZip(archive).totalBytes;
    } catch (error) {
      expect(error).toBeInstanceOf(ZipValidationError);
    }
    expect(total).toBeLessThan(1024);
  });
});
