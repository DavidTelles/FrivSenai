-- Neon database schema. There are no user accounts: anyone can publish, and the server is the only database client.
-- File storage stays in Supabase.

create extension if not exists pg_trgm;

-- Tables ---------------------------------------------------------------------

create table public.categories (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null unique,
  position smallint not null default 100
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  category_id smallint not null references public.categories (id),
  slug text not null unique,
  title text not null,
  description text not null,
  developer_name text not null,
  controls text not null,
  technologies text[] not null default '{}',
  cover_url text not null,
  source_type text not null,
  entry_path text,
  external_url text,
  embed_status text not null default 'embeddable',
  status text not null default 'published',
  is_featured boolean not null default false,
  view_count bigint not null default 0,
  publisher_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint games_title_length check (char_length(title) between 2 and 80),
  constraint games_description_length check (char_length(description) between 10 and 4000),
  constraint games_developer_length check (char_length(developer_name) between 2 and 60),
  constraint games_controls_length check (char_length(controls) between 2 and 500),
  constraint games_technologies_count check (cardinality(technologies) <= 10),
  constraint games_cover_url check (cover_url ~ '^https?://'),
  constraint games_source_type check (source_type in ('zip', 'url')),
  constraint games_embed_status check (embed_status in ('embeddable', 'blocked')),
  constraint games_status check (status in ('published', 'hidden')),
  constraint games_source_shape check (
    (source_type = 'zip' and entry_path is not null and external_url is null)
    or (source_type = 'url' and external_url ~ '^https://' and entry_path is null)
  )
);
create index games_feed_recent_idx on public.games (created_at desc) where status = 'published';
create index games_feed_popular_idx on public.games (view_count desc, created_at desc) where status = 'published';
create index games_featured_idx on public.games (created_at desc) where status = 'published' and is_featured;
create index games_category_recent_idx on public.games (category_id, created_at desc) where status = 'published';
create index games_publisher_idx on public.games (publisher_key, created_at desc);
create index games_title_trgm_idx on public.games using gin (title gin_trgm_ops);

create table public.game_files (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  path text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (game_id, path)
);

create table public.game_views (
  game_id uuid not null references public.games (id) on delete cascade,
  viewer_key text not null,
  viewed_on date not null default current_date,
  primary key (game_id, viewer_key, viewed_on),
  constraint game_views_viewer_key check (viewer_key ~ '^[A-Za-z0-9-]{16,64}$')
);

-- Functions and triggers -----------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger games_updated_at before update on public.games
  for each row execute function public.set_updated_at();

create function public.record_game_view(p_game_id uuid, p_viewer_key text) returns void
language plpgsql set search_path = '' as $$
declare
  inserted integer;
begin
  if not exists (select 1 from public.games where id = p_game_id and status = 'published') then
    return;
  end if;
  insert into public.game_views (game_id, viewer_key)
  values (p_game_id, p_viewer_key)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    update public.games set view_count = view_count + 1 where id = p_game_id;
  end if;
end;
$$;

-- Seed categories ------------------------------------------------------------

insert into public.categories (slug, name, position) values
  ('adventure', 'Adventure', 10),
  ('action', 'Action', 20),
  ('platform', 'Platform', 30),
  ('horror', 'Horror', 40),
  ('strategy', 'Strategy', 50),
  ('racing', 'Racing', 60),
  ('puzzle', 'Puzzle', 70),
  ('other', 'Other', 80);
