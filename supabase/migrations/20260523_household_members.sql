begin;

create or replace function public.get_household_members()
returns table (
  id uuid,
  display_name text,
  email text,
  role text,
  is_current_user boolean
)
language sql
security definer
set search_path = public, auth
as $$
  select
    p.id,
    coalesce(
      nullif(p.display_name, ''),
      nullif(au.raw_user_meta_data->>'display_name', ''),
      split_part(au.email, '@', 1)
    ) as display_name,
    au.email,
    p.role::text,
    p.id = auth.uid() as is_current_user
  from public.profiles p
  left join auth.users au on au.id = p.id
  where p.household_id = public.my_household_id()
    and public.my_household_id() is not null
  order by is_current_user desc, p.role asc, p.id asc;
$$;

revoke execute on function public.get_household_members() from public;
grant execute on function public.get_household_members() to authenticated;

commit;
