-- Live cross-device sleep sync: a sleep now starts as an open row
-- (ended_at null) the moment the timer starts, so realtime delivers it to
-- every household device immediately, not just once it's confirmed.
--
-- Unlike feed_sessions/nappy_logs/medicine_logs, sleep updates are not
-- restricted to the original author: ending or correcting a sleep someone
-- else in the household started is the whole point of this feature (e.g.
-- one parent starts it, the other is the one free to tap "awake" later).

begin;

alter table public.sleep_logs alter column ended_at drop not null;

alter table public.sleep_logs drop constraint if exists sleep_logs_time_check;
alter table public.sleep_logs add constraint sleep_logs_time_check
  check (ended_at is null or ended_at >= started_at);

grant update on table public.sleep_logs to authenticated;

drop policy if exists sleeps_update on public.sleep_logs;
create policy sleeps_update on public.sleep_logs
  for update
  to authenticated
  using (household_id = public.my_household_id())
  with check (household_id = public.my_household_id());

commit;
