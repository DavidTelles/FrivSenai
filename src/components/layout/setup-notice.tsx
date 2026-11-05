export function SetupNotice() {
  return (
    <section className="tile mx-auto max-w-2xl p-6">
      <h1 className="font-display text-2xl font-bold">Supabase is not connected yet</h1>
      <p className="mt-2 text-muted">
        Copy <code>.env.example</code> to <code>.env.local</code>, fill in your project credentials and restart the
        server. The README lists where to find each value.
      </p>
    </section>
  );
}
