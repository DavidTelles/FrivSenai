import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { beforeAll, describe, expect, it } from "vitest";

const GAME = "00000000-0000-4000-8000-0000000000aa";
const HIDDEN = "00000000-0000-4000-8000-0000000000bb";

let db: PGlite;
const query = (sql: string) => db.query<Record<string, unknown>>(sql);
const count = async (sql: string) => Number((await query(sql)).rows[0].n);

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(readFileSync("db/schema.sql", "utf8"));
  await db.exec(`
    insert into public.games (id, category_id, slug, title, description, developer_name, controls, cover_url, source_type, entry_path, status, publisher_key)
    values ('${GAME}', 1, 'open-game', 'Open', 'A description.', 'Alice', 'keys', 'https://x.co/c.png', 'zip', 'index.html', 'published', 'k'),
           ('${HIDDEN}', 1, 'hidden-game', 'Hidden', 'A description.', 'Alice', 'keys', 'https://x.co/c.png', 'zip', 'index.html', 'hidden', 'k');
  `);
});

describe("games", () => {
  it("rejects a javascript: external URL", async () => {
    await expect(
      query(`insert into public.games (category_id, slug, title, description, developer_name, controls, cover_url, source_type, external_url, publisher_key)
             values (1, 'js-x', 'XX', 'A description.', 'AA', 'keys', 'https://x.co', 'url', 'javascript:alert(1)', 'k')`),
    ).rejects.toThrow(/games_source_shape/);
  });
  it("requires a publisher key", async () => {
    await expect(
      query(`insert into public.games (category_id, slug, title, description, developer_name, controls, cover_url, source_type, external_url)
             values (1, 'no-key', 'XX', 'A description.', 'AA', 'keys', 'https://x.co', 'url', 'https://x.co')`),
    ).rejects.toThrow(/publisher_key/);
  });
});

describe("views", () => {
  it("counts a viewer once per day and ignores hidden games", async () => {
    const key = "viewer-key-0000000001";
    await query(`select public.record_game_view('${GAME}','${key}')`);
    await query(`select public.record_game_view('${GAME}','${key}')`);
    expect(await count(`select view_count n from public.games where id='${GAME}'`)).toBe(1);
    await query(`select public.record_game_view('${HIDDEN}','${key}')`);
    expect(await count(`select view_count n from public.games where id='${HIDDEN}'`)).toBe(0);
  });
});
