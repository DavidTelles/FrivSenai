"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="tile mx-auto mt-8 max-w-lg p-6 text-center">
      <h1 className="font-display text-2xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 text-muted">The page could not be loaded.</p>
      <button className="btn btn-primary mt-4" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
