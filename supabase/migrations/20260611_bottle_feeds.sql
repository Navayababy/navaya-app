-- Bottle feeds (mixed feeding): feed_sessions gains a feed_type discriminator
-- plus bottle-only amount/milk-type columns. Additive and backward compatible:
-- old clients never send the new columns and the default keeps their rows
-- 'breast', so this migration is applied BEFORE the client change ships.

begin;

alter table public.feed_sessions
  add column if not exists feed_type text not null default 'breast';
alter table public.feed_sessions
  add column if not exists amount_ml integer;
alter table public.feed_sessions
  add column if not exists milk_type text;

-- Bottle feeds have no side
alter table public.feed_sessions alter column side drop not null;

alter table public.feed_sessions drop constraint if exists feed_sessions_side_check;
alter table public.feed_sessions add constraint feed_sessions_side_check
  check (side is null or side in ('L', 'R'));

alter table public.feed_sessions drop constraint if exists feed_sessions_feed_type_check;
alter table public.feed_sessions add constraint feed_sessions_feed_type_check
  check (feed_type in ('breast', 'bottle'));

alter table public.feed_sessions drop constraint if exists feed_sessions_amount_check;
alter table public.feed_sessions add constraint feed_sessions_amount_check
  check (amount_ml is null or amount_ml between 1 and 500);

alter table public.feed_sessions drop constraint if exists feed_sessions_milk_type_check;
alter table public.feed_sessions add constraint feed_sessions_milk_type_check
  check (milk_type is null or milk_type in ('expressed', 'formula'));

-- Soft consistency: a bottle feed never carries a side. Deliberately does NOT
-- forbid amount/milk on breast rows, so an old client updating a row without
-- sending feed_type can never trip a violation.
alter table public.feed_sessions drop constraint if exists feed_sessions_bottle_side_check;
alter table public.feed_sessions add constraint feed_sessions_bottle_side_check
  check (feed_type <> 'bottle' or side is null);

commit;
