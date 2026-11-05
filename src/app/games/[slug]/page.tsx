import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/games/game-player";
import { compactNumber, formatDate } from "@/lib/format";
import { getGameBySlug } from "@/services/games";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  return game ? { title: game.title, description: game.description.slice(0, 160) } : { title: "Game not found" };
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  return (
    <article>
      <GamePlayer
        gameId={game.id}
        title={game.title}
        sourceType={game.source_type}
        entryPath={game.entry_path}
        externalUrl={game.external_url}
        embedStatus={game.embed_status}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold">{game.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {game.category && (
              <Link className="font-semibold underline" href={`/games?category=${game.category.slug}`}>
                {game.category.name}
              </Link>
            )}{" "}
            · by {game.developer_name} · {formatDate(game.created_at)}
          </p>
          <p className="mt-1 text-sm font-semibold">{compactNumber(game.view_count)} views</p>
          <p className="mt-5 whitespace-pre-line">{game.description}</p>
        </div>
        <aside className="space-y-4">
          <div className="tile overflow-hidden">
            <div className="relative aspect-[4/3]">
              <Image src={game.cover_url} alt={`${game.title} cover`} fill sizes="20rem" className="object-cover" />
            </div>
          </div>
          <div className="tile p-4">
            <h2 className="font-display font-bold">Controls</h2>
            <p className="mt-1 whitespace-pre-line text-sm">{game.controls}</p>
            {game.technologies.length > 0 && (
              <>
                <h2 className="mt-3 font-display font-bold">Built with</h2>
                <p className="mt-1 text-sm">{game.technologies.join(", ")}</p>
              </>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}
