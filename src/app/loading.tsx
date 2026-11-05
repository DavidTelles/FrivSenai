export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="aspect-[4/3] animate-pulse rounded-xl bg-line/10" />
      ))}
    </div>
  );
}
