import Link from "next/link";

const NAV = [
  { href: "/games", label: "Categories" },
  { href: "/games?sort=popular", label: "Popular" },
  { href: "/games?sort=recent", label: "New" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-2xl font-extrabold tracking-tight">
          Friv<span className="text-brand">Senai</span>
        </Link>
        <form action="/games" role="search" className="order-last w-full md:order-none md:w-auto md:flex-1 md:max-w-md">
          <input name="q" type="search" placeholder="Search games" aria-label="Search games" className="field" />
        </form>
        <nav aria-label="Main" className="flex items-center gap-3 text-sm font-semibold">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-brand">
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/publish" className="btn btn-primary">
            Publish a Game
          </Link>
        </div>
      </div>
    </header>
  );
}
