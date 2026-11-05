import type { Metadata } from "next";
import { PublishForm } from "@/components/publish/publish-form";
import { listCategories } from "@/services/games";

export const metadata: Metadata = { title: "Publish a Game" };

export default async function PublishPage() {
  return <PublishForm categories={await listCategories()} />;
}
