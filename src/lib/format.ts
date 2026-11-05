const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export const compactNumber = (value: number) => compact.format(value);
export const formatDate = (value: string) => date.format(new Date(value));

export function popularityLabel(score: number): string | null {
  if (score >= 5000) return "On fire";
  if (score >= 500) return "Hot";
  if (score >= 50) return "Rising";
  return null;
}
