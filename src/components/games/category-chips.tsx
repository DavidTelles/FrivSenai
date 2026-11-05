import Link from "next/link";
import type { Category } from "@/types";

export function CategoryChips({ categories, active }: { categories: Category[]; active?: string }) {
  const chip = "shrink-0 rounded-full border-2 border-line px-3 py-1 text-sm font-semibold transition-colors";
  return (
    <nav aria-label="Categories" className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      <Link href="/games" className={`${chip} ${active ? "bg-card hover:bg-sun" : "bg-sun"}`}>
        All
      </Link>
      {categories.map(({ slug, name }) => (
        <Link
          key={slug}
          href={`/games?category=${slug}`}
          aria-current={active === slug ? "page" : undefined}
          className={`${chip} ${active === slug ? "bg-sun" : "bg-card hover:bg-sun"}`}
        >
          {name}
        </Link>
      ))}
    </nav>
  );
}
