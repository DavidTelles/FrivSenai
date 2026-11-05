import Link from "next/link";
import { CategoryChips } from "@/components/games/category-chips";
import { GameGrid } from "@/components/games/game-card";
import { SetupNotice } from "@/components/layout/setup-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { listCategories, listGames } from "@/services/games";
import type { GameCard } from "@/types";

export const revalidate = 60;

const SECTION_SIZE = 8;

function Section({ title, href, games }: { title: string; href: string; games: GameCard[] }) {
  if (games.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl font-extrabold">{title}</h2>
        <Link href={href} className="shrink-0 text-sm font-semibold underline underline-offset-4 hover:text-brand">
          See all
        </Link>
      </div>
      <GameGrid games={games} />
    </section>
  );
}

export default async function HomePage() {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const categories = await listCategories();
  const limit = SECTION_SIZE;
  const [featured, popular, recent, byCategory] = await Promise.all([
    listGames({ featured: true, limit }),
    listGames({ sort: "popular", limit }),
    listGames({ sort: "recent", limit }),
    Promise.all(categories.map((category) => listGames({ categoryId: category.id, sort: "popular", limit: 4 }))),
  ]);

  return (
    <>
      <CategoryChips categories={categories} />
      {recent.length === 0 && (
        <section className="tile mt-8 p-8 text-center">
          <h1 className="font-display text-3xl font-extrabold">No games yet</h1>
          <p className="mt-2 text-muted">Be the first to share a creation with the community.</p>
          <Link href="/publish" className="btn btn-primary mt-4">
            Publish a Game
          </Link>
        </section>
      )}
      <Section title="Featured Games" href="/games" games={featured} />
      <Section title="Most Popular" href="/games?sort=popular" games={popular} />
      <Section title="Recently Added" href="/games?sort=recent" games={recent} />
      {categories.map((category, index) => (
        <Section
          key={category.id}
          title={category.slug === "other" ? "Other Categories" : `${category.name} Games`}
          href={`/games?category=${category.slug}`}
          games={byCategory[index]}
        />
      ))}
    </>
  );
}
