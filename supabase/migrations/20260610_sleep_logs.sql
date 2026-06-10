-- Sleep logs: shared sleep tracking for households.
-- RLS mirrors nappy_logs: household members can read, authors can
-- insert/delete their own entries. Included in the realtime publication.

begin;

create table public.sleep_logs (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id),
  logged_by     uuid references auth.users(id),
  started_at    timestamptz not null,
  ended_at      timestamptz not null,
  duration_secs integer check (duration_secs is null or duration_secs >= 0),
  created_at    timestamptz not null default now()
);

alter table public.sleep_logs enable row level security;

create policy sleeps_select on public.sleep_logs
  for select using (household_id = public.my_household_id());

create policy sleeps_insert on public.sleep_logs
  for insert with check (household_id = public.my_household_id() and logged_by = auth.uid());

create policy sleeps_delete on public.sleep_logs
  for delete using (logged_by = auth.uid() and household_id = public.my_household_id());

create index sleep_logs_household_started_idx
  on public.sleep_logs (household_id, started_at desc);

alter publication supabase_realtime add table public.sleep_logs;

commit;
