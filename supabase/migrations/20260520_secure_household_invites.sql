create extension if not exists pgcrypto;

begin;

-- Tighten table privileges
revoke all on table public.babies from anon;
revoke all on table public.feed_sessions from anon;
revoke all on table public.household_invites from anon;
revoke all on table public.households from anon;
revoke all on table public.medicine_logs from anon;
revoke all on table public.nappy_logs from anon;
revoke all on table public.profiles from anon;

revoke all on table public.babies from authenticated;
revoke all on table public.feed_sessions from authenticated;
revoke all on table public.household_invites from authenticated;
revoke all on table public.households from authenticated;
revoke all on table public.medicine_logs from authenticated;
revoke all on table public.nappy_logs from authenticated;
revoke all on table public.profiles from authenticated;

grant select, insert on table public.babies to authenticated;
grant select, insert, update, delete on table public.feed_sessions to authenticated;
grant select on table public.households to authenticated;
grant select, insert, delete on table public.medicine_logs to authenticated;
grant select, insert, delete on table public.nappy_logs to authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- Constraints (idempotent)
alter table public.feed_sessions drop constraint if exists feed_sessions_duration_check;
alter table public.feed_sessions add constraint feed_sessions_duration_check check (duration_secs is null or duration_secs >= 0);
alter table public.feed_sessions drop constraint if exists feed_sessions_time_check;
alter table public.feed_sessions add constraint feed_sessions_time_check check (ended_at is null or ended_at >= started_at);

alter table public.medicine_logs drop constraint if exists medicine_logs_dose_check;
alter table public.medicine_logs add constraint medicine_logs_dose_check check (dose_ml is null or dose_ml between 0 and 50);
alter table public.medicine_logs drop constraint if exists medicine_logs_name_length_check;
alter table public.medicine_logs add constraint medicine_logs_name_length_check check (char_length(name) <= 100);
alter table public.medicine_logs drop constraint if exists medicine_logs_notes_length_check;
alter table public.medicine_logs add constraint medicine_logs_notes_length_check check (notes is null or char_length(notes) <= 500);

alter table public.nappy_logs drop constraint if exists nappy_logs_poo_colour_check;
alter table public.nappy_logs add constraint nappy_logs_poo_colour_check check (poo_color is null or poo_color in ('mustard','yellow','green','brown','dark'));

-- Policies
DROP POLICY IF EXISTS households_insert ON public.households;
DROP POLICY IF EXISTS households_select ON public.households;
CREATE POLICY households_select
  ON public.households
  FOR SELECT
  TO authenticated
  USING (id = public.my_household_id());

DROP POLICY IF EXISTS feeds_update ON public.feed_sessions;
CREATE POLICY feeds_update
  ON public.feed_sessions
  FOR UPDATE
  TO authenticated
  USING (logged_by = auth.uid() and household_id = public.my_household_id())
  WITH CHECK (logged_by = auth.uid() and household_id = public.my_household_id());

DROP POLICY IF EXISTS feeds_delete ON public.feed_sessions;
CREATE POLICY feeds_delete
  ON public.feed_sessions
  FOR DELETE
  TO authenticated
  USING (logged_by = auth.uid() and household_id = public.my_household_id());

DROP POLICY IF EXISTS nappies_delete ON public.nappy_logs;
CREATE POLICY nappies_delete
  ON public.nappy_logs
  FOR DELETE
  TO authenticated
  USING (logged_by = auth.uid() and household_id = public.my_household_id());

DROP POLICY IF EXISTS medicines_delete ON public.medicine_logs;
CREATE POLICY medicines_delete
  ON public.medicine_logs
  FOR DELETE
  TO authenticated
  USING (logged_by = auth.uid() and household_id = public.my_household_id());

DROP POLICY IF EXISTS invites_insert ON public.household_invites;
DROP POLICY IF EXISTS invites_select ON public.household_invites;
DROP POLICY IF EXISTS invites_update ON public.household_invites;

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Helper to generate a secure invite code
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw_bytes bytea;
  code text := '';
  i int;
  byte_val int;
begin
  raw_bytes := gen_random_bytes(8);

  for i in 0..7 loop
    byte_val := get_byte(raw_bytes, i);
    code := code || substr(alphabet, (byte_val % char_length(alphabet)) + 1, 1);
  end loop;

  return code;
end;
$$;

create or replace function public.create_household_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household_id uuid;
  v_existing_household uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id)
  values (v_uid)
  on conflict (id) do nothing;

  select household_id
    into v_existing_household
  from public.profiles
  where id = v_uid
  for update;

  if v_existing_household is not null then
    return v_existing_household;
  end if;

  insert into public.households default values returning id into v_household_id;

  update public.profiles
  set household_id = v_household_id,
      role = 'primary'
  where id = v_uid
    and household_id is null;

  return v_household_id;
end;
$$;

create or replace function public.create_household_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household_id uuid;
  v_role text;
  v_code text;
  v_hash text;
  v_created boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select household_id, role
    into v_household_id, v_role
  from public.profiles
  where id = v_uid;

  if v_household_id is null then
    raise exception 'Create a household first';
  end if;

  if v_role <> 'primary' then
    raise exception 'Only primary household members can create invites';
  end if;

  while not v_created loop
    begin
      v_code := public.generate_invite_code();
      v_hash := encode(digest(upper(v_code), 'sha256'), 'hex');

      insert into public.household_invites (household_id, invite_code, expires_at)
      values (v_household_id, v_hash, now() + interval '24 hours');

      v_created := true;
    exception
      when unique_violation then
        v_created := false;
    end;
  end loop;

  return v_code;
end;
$$;

create or replace function public.accept_household_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_household uuid;
  v_invite_id uuid;
  v_household_id uuid;
  v_hash text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id)
  values (v_uid)
  on conflict (id) do nothing;

  select household_id
    into v_existing_household
  from public.profiles
  where id = v_uid
  for update;

  if v_existing_household is not null then
    raise exception 'You are already in a household';
  end if;

  v_hash := encode(digest(upper(trim(p_invite_code)), 'sha256'), 'hex');

  select id, household_id
    into v_invite_id, v_household_id
  from public.household_invites
  where invite_code = v_hash
    and accepted_at is null
    and expires_at > now()
  for update;

  if v_invite_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  update public.profiles
  set household_id = v_household_id,
      role = 'partner'
  where id = v_uid
    and household_id is null;

  update public.household_invites
  set accepted_at = now()
  where id = v_invite_id;

  return v_household_id;
end;
$$;

revoke execute on function public.generate_invite_code() from public;
revoke execute on function public.create_household_for_current_user() from public;
revoke execute on function public.create_household_invite() from public;
revoke execute on function public.accept_household_invite(text) from public;

grant execute on function public.create_household_for_current_user() to authenticated;
grant execute on function public.create_household_invite() to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;

commit;
