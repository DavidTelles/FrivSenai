-- Supabase hosts file storage only. Application tables live in Neon (db/schema.sql).
-- Browsers upload to "uploads" through signed URLs issued by the server, so no insert policy is needed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('uploads', 'uploads', false, 104857600,
    array['application/zip', 'application/x-zip-compressed', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('game-covers', 'game-covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('game-files', 'game-files', true, 52428800, null)
on conflict (id) do nothing;

create policy "game covers are public" on storage.objects
  for select using (bucket_id = 'game-covers');
create policy "game files are public" on storage.objects
  for select using (bucket_id = 'game-files');
