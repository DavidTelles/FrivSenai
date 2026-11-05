import Image from "next/image";
import Link from "next/link";
import { compactNumber, popularityLabel } from "@/lib/format";
import type { GameCard as GameCardData } from "@/types";

export function GameCard({ game }: { game: GameCardData }) {
  const heat = popularityLabel(game.view_count);
  return (
    <Link href={`/games/${game.slug}`} className="tile game-card group block overflow-hidden">
      <div className="relative aspect-[4/3] border-b-2 border-line bg-sun">
        <Image
          src={game.cover_url}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover"
        />
        {heat && (
          <span className="absolute left-2 top-2 rounded-md border-2 border-line bg-sun px-2 py-0.5 text-xs font-bold">
            {heat}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="truncate font-display text-base font-bold group-hover:text-brand">{game.title}</h3>
        <p className="truncate text-xs text-muted">
          {game.category?.name} · {game.developer_name}
        </p>
        <p className="mt-1 text-xs font-semibold">
          {compactNumber(game.view_count)} views
        </p>
      </div>
    </Link>
  );
}

export function GameGrid({ games }: { games: GameCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
