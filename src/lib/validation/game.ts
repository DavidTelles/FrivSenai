import { z } from "zod";

const metadata = {
  title: z.string().trim().min(2, "Title needs at least 2 characters.").max(80),
  description: z.string().trim().min(10, "Description needs at least 10 characters.").max(4000),
  categoryId: z.coerce.number().int().positive("Choose a category."),
  developerName: z.string().trim().min(2, "Developer name needs at least 2 characters.").max(60),
  controls: z.string().trim().min(2, "Describe the controls.").max(500),
  technologies: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
};

export const gameMetadataSchema = z.object(metadata);

const uploadId = z.uuid("Invalid upload.");

export const publishSchema = z.discriminatedUnion("sourceType", [
  z.object({ ...metadata, sourceType: z.literal("zip"), uploadId }),
  z.object({ ...metadata, sourceType: z.literal("url"), uploadId, url: z.string().url().max(2000) }),
]);

export type PublishInput = z.infer<typeof publishSchema>;
