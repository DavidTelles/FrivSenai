"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UrlCheckResult } from "@/lib/games/url-rules";
import { detectCoverImage } from "@/lib/games/file-rules";
import { createClient } from "@/lib/supabase/client";
import { gameMetadataSchema } from "@/lib/validation/game";
import type { Category } from "@/types";

const MAX_ZIP = 100 * 1024 * 1024;
const MAX_COVER = 5 * 1024 * 1024;

type SourceType = "zip" | "url";
type UploadTarget = { path: string; token: string };
type UploadSlot = { uploadId: string; cover: UploadTarget; zip: UploadTarget | null };

export function PublishForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [values, setValues] = useState({ title: "", description: "", categoryId: "", developerName: "", controls: "", technologies: "" });
  const [sourceType, setSourceType] = useState<SourceType>("zip");
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [urlCheck, setUrlCheck] = useState<UrlCheckResult | null>(null);
  const [step, setStep] = useState<"edit" | "preview">("edit");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseCover = (file: File | null) => {
    setCover(file);
    setCoverPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const metadata = () => ({
    ...values,
    technologies: values.technologies.split(",").map((item) => item.trim()).filter(Boolean),
  });

  const checkUrl = async (): Promise<UrlCheckResult> => {
    const response = await fetch("/api/url-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const result: UrlCheckResult = response.ok
      ? await response.json()
      : { ok: false, error: (await response.json().catch(() => null))?.error ?? "Could not check the URL." };
    setUrlCheck(result);
    return result;
  };

  const toPreview = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = gameMetadataSchema.safeParse(metadata());
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (!cover) return setError("Choose a cover image.");
    if (cover.size > MAX_COVER) return setError("The cover must be 5 MB or smaller.");
    if (!detectCoverImage(new Uint8Array(await cover.slice(0, 16).arrayBuffer()))) {
      return setError("The cover must be a real PNG, JPEG, WebP or GIF image.");
    }
    if (sourceType === "zip") {
      if (!zip) return setError("Choose a ZIP file.");
      if (zip.size > MAX_ZIP) return setError("The ZIP must be 100 MB or smaller.");
    } else {
      setProgress("Checking URL…");
      const result = await checkUrl();
      setProgress(null);
      if (!result.ok) return setError(result.error);
    }
    setStep("preview");
  };

  const stage = async (file: File, slot: UploadTarget) => {
    const { error: failure } = await createClient()
      .storage.from("uploads")
      .uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type });
    if (failure) throw new Error(`Upload failed: ${failure.message}`);
  };

  const publish = async () => {
    setError(null);
    try {
      setProgress("Preparing upload…");
      const slotResponse = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip: sourceType === "zip" }),
      });
      const slot: UploadSlot | { error?: string } | null = await slotResponse.json().catch(() => null);
      if (!slotResponse.ok || !slot || !("uploadId" in slot)) throw new Error((slot as { error?: string })?.error ?? "Upload failed.");
      setProgress("Uploading cover…");
      await stage(cover!, slot.cover);
      if (sourceType === "zip") {
        setProgress("Uploading ZIP…");
        await stage(zip!, slot.zip!);
      }
      setProgress("Validating and publishing…");
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...metadata(), sourceType, uploadId: slot.uploadId, ...(sourceType === "url" ? { url } : {}) }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Publishing failed.");
      router.push(`/games/${result.slug}`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Publishing failed.");
      setProgress(null);
    }
  };

  const blocked = urlCheck?.ok && urlCheck.embedStatus === "blocked" ? urlCheck.reason : null;

  if (step === "preview") {
    const category = categories.find(({ id }) => String(id) === values.categoryId);
    return (
      <div className="tile mx-auto max-w-3xl p-6">
        <h1 className="font-display text-2xl font-extrabold">Review before publishing</h1>
        <div className="mt-4 grid gap-5 sm:grid-cols-[14rem_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {coverPreview && <img src={coverPreview} alt="Cover preview" className="aspect-[4/3] w-full rounded-lg border-2 border-line object-cover" />}
          <dl className="space-y-1 text-sm">
            <h2 className="font-display text-xl font-bold">{values.title}</h2>
            <p>{category?.name} · {values.developerName}</p>
            <p className="whitespace-pre-line">{values.description}</p>
            <p><strong>Controls:</strong> {values.controls}</p>
            {values.technologies && <p><strong>Built with:</strong> {values.technologies}</p>}
            <p className="break-all"><strong>Source:</strong> {sourceType === "zip" ? zip?.name : url}</p>
          </dl>
        </div>
        {blocked && (
          <p role="alert" className="mt-4 rounded-lg border-2 border-line bg-sun p-3 text-sm font-semibold">
            This game cannot run inside FrivSenai. {blocked} Its page will only link to the original site.
          </p>
        )}
        {error && <p role="alert" className="mt-4 text-sm font-semibold text-brand-dark">{error}</p>}
        {progress && <p role="status" className="mt-4 text-sm font-semibold">{progress}</p>}
        <div className="mt-5 flex gap-2">
          <button className="btn" disabled={Boolean(progress)} onClick={() => setStep("edit")}>Back</button>
          <button className="btn btn-primary" disabled={Boolean(progress)} onClick={publish}>Publish</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={toPreview} className="tile mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="font-display text-2xl font-extrabold">Publish a Game</h1>
      <label className="text-sm font-semibold">Game title
        <input className="field mt-1 font-normal" required maxLength={80} value={values.title} onChange={set("title")} />
      </label>
      <label className="text-sm font-semibold">Description
        <textarea className="field mt-1 font-normal" rows={4} required maxLength={4000} value={values.description} onChange={set("description")} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Category
          <select className="field mt-1 font-normal" required value={values.categoryId} onChange={set("categoryId")}>
            <option value="">Choose…</option>
            {categories.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Developer name
          <input className="field mt-1 font-normal" required maxLength={60} value={values.developerName} onChange={set("developerName")} />
        </label>
      </div>
      <label className="text-sm font-semibold">Game controls
        <input className="field mt-1 font-normal" required maxLength={500} placeholder="Arrows to move, space to jump" value={values.controls} onChange={set("controls")} />
      </label>
      <label className="text-sm font-semibold">Technologies used (optional, comma separated)
        <input className="field mt-1 font-normal" value={values.technologies} onChange={set("technologies")} />
      </label>
      <label className="text-sm font-semibold">Cover image (PNG, JPEG, WebP or GIF, up to 5 MB)
        <input className="field mt-1 font-normal" type="file" required accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => chooseCover(event.target.files?.[0] ?? null)} />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">Import type</legend>
        <div className="mt-1 flex gap-4 text-sm">
          {(["zip", "url"] as const).map((type) => (
            <label key={type} className="flex items-center gap-2">
              <input type="radio" name="source" checked={sourceType === type} onChange={() => setSourceType(type)} />
              {type === "zip" ? "ZIP file" : "External URL"}
            </label>
          ))}
        </div>
      </fieldset>
      {sourceType === "zip" ? (
        <label className="text-sm font-semibold">Game ZIP (must contain index.html, up to 100 MB)
          <input className="field mt-1 font-normal" type="file" required accept=".zip,application/zip" onChange={(event) => setZip(event.target.files?.[0] ?? null)} />
        </label>
      ) : (
        <label className="text-sm font-semibold">Game URL (https only)
          <input className="field mt-1 font-normal" type="url" required placeholder="https://" value={url} onChange={(event) => { setUrl(event.target.value); setUrlCheck(null); }} />
        </label>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-brand-dark">{error}</p>}
      {progress && <p role="status" className="text-sm font-semibold">{progress}</p>}
      <button className="btn btn-primary self-start" disabled={Boolean(progress)}>Preview</button>
    </form>
  );
}
