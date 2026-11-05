import type { Metadata } from "next";
import Link from "next/link";
import { CategoryChips } from "@/components/games/category-chips";
import { GameGrid } from "@/components/games/game-card";
import { SetupNotice } from "@/components/layout/setup-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { listCategories, listGames, PAGE_SIZE } from "@/services/games";
import type { FeedSort } from "@/types";

export const metadata: Metadata = { title: "Browse games" };

const SORTS: { value: FeedSort; label: string }[] = [
  { value: "popular", label: "Most popular" },
  { value: "recent", label: "Newest" },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function BrowsePage({ searchParams }: { searchParams: SearchParams }) {
  if (!isSupabaseConfigured) return <SetupNotice />;
  const params = await searchParams;
  const search = one(params.q)?.trim().slice(0, 80) || undefined;
  const categorySlug = one(params.category);
  const sort = SORTS.find(({ value }) => value === one(params.sort))?.value ?? "popular";
  const page = Math.max(1, Math.min(Number(one(params.page)) || 1, 1000));

  const categories = await listCategories();
  const category = categories.find(({ slug }) => slug === categorySlug);
  const results = await listGames({
    search,
    sort,
    categoryId: category?.id,
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE + 1,
  });
  const games = results.slice(0, PAGE_SIZE);

  const linkFor = (overrides: Record<string, string>) => {
    const query = new URLSearchParams({
      ...(search ? { q: search } : {}),
      ...(category ? { category: category.slug } : {}),
      sort,
      ...overrides,
    });
    return `/games?${query}`;
  };

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">
        {search ? `Results for “${search}”` : category ? `${category.name} Games` : "All Games"}
      </h1>
      <div className="mt-4">
        <CategoryChips categories={categories} active={category?.slug} />
      </div>
      <div className="my-4 flex flex-wrap gap-2 text-sm font-semibold">
        {SORTS.map(({ value, label }) => (
          <Link
            key={value}
            href={linkFor({ sort: value })}
            aria-current={sort === value ? "true" : undefined}
            className={sort === value ? "underline decoration-brand decoration-2 underline-offset-4" : "text-muted hover:text-ink"}
          >
            {label}
          </Link>
        ))}
      </div>
      {games.length ? <GameGrid games={games} /> : <p className="tile p-8 text-center text-muted">No games found.</p>}
      <div className="mt-8 flex justify-center gap-3">
        {page > 1 && (
          <Link className="btn" href={linkFor({ page: String(page - 1) })}>
            Previous
          </Link>
        )}
        {results.length > PAGE_SIZE && (
          <Link className="btn" href={linkFor({ page: String(page + 1) })}>
            Next
          </Link>
        )}
      </div>
    </>
  );
}
