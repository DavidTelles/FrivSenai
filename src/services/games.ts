import "server-only";
import { sql } from "@/lib/db";
import type { Category, FeedSort, GameCard, GameDetail } from "@/types";

const CARD_COLUMNS = `g.id, g.slug, g.title, g.cover_url, g.developer_name, g.view_count::float8 as view_count,
  to_json(g.created_at) #>> '{}' as created_at, json_build_object('slug', c.slug, 'name', c.name) as category`;
const CARD_FROM = "from public.games g join public.categories c on c.id = g.category_id";

const SORT_COLUMN: Record<FeedSort, string> = {
  popular: "g.view_count",
  recent: "g.created_at",
};

export const PAGE_SIZE = 24;

function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listCategories(): Promise<Category[]> {
  return (await sql`select id, slug, name from public.categories order by position`) as Category[];
}

type FeedOptions = {
  sort?: FeedSort;
  categoryId?: number;
  search?: string;
  featured?: boolean;
  offset?: number;
  limit?: number;
};

export async function listGames(options: FeedOptions = {}): Promise<GameCard[]> {
  const { sort = "recent", search, featured, categoryId, offset = 0, limit = PAGE_SIZE } = options;
  const params: unknown[] = [];
  const where = ["g.status = 'published'"];
  const bind = (value: unknown) => `$${params.push(value)}`;
  if (categoryId) where.push(`g.category_id = ${bind(categoryId)}`);
  if (featured) where.push("g.is_featured");
  if (search) where.push(`g.title ilike ${bind(`%${escapeLike(search)}%`)}`);
  const query = `select ${CARD_COLUMNS} ${CARD_FROM} where ${where.join(" and ")}
    order by ${SORT_COLUMN[sort]} desc, g.created_at desc limit ${bind(limit)} offset ${bind(offset)}`;
  return (await sql.query(query, params)) as GameCard[];
}

export async function getGameBySlug(slug: string): Promise<GameDetail | null> {
  const query = `select ${CARD_COLUMNS}, g.category_id, g.description, g.controls, g.technologies,
      g.source_type, g.entry_path, g.external_url, g.embed_status
    ${CARD_FROM} where g.slug = $1 and g.status = 'published'`;
  const [game] = await sql.query(query, [slug]);
  return (game as GameDetail | undefined) ?? null;
}

export async function recordView(gameId: string, viewerKey: string) {
  await sql`select public.record_game_view(${gameId}, ${viewerKey})`;
}
