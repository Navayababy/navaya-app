-- Announcements: a single owner-controlled broadcast banner shown to every app
-- user, signed in or anonymous. Read access is open to all, but RLS limits it
-- to rows that are active and inside their optional start/end window.
--
-- There is deliberately NO insert/update/delete policy. Writes are therefore
-- impossible with the app's anon/authenticated keys and can only be made via
-- the Supabase dashboard (service role), which gives an owner-only publish
-- boundary without any in-app admin surface to secure.

begin;

create table public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text,
  body         text not null,
  type         text not null default 'info' check (type in ('info', 'feature', 'sale')),
  action_url   text,
  action_label text,
  active       boolean not null default true,
  starts_at    timestamptz,
  ends_at      timestamptz,
  priority     integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- Anyone (logged out or in) may read only the banners that are live right now.
create policy announcements_select on public.announcements
  for select
  using (
    active
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );

grant select on public.announcements to anon, authenticated;

create index announcements_live_idx
  on public.announcements (active, priority desc, created_at desc);

commit;
