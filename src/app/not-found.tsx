import Link from "next/link";

export default function NotFound() {
  return (
    <section className="tile mx-auto mt-8 max-w-lg p-6 text-center">
      <h1 className="font-display text-2xl font-extrabold">Page not found</h1>
      <Link href="/" className="btn btn-primary mt-4">
        Back to games
      </Link>
    </section>
  );
}
