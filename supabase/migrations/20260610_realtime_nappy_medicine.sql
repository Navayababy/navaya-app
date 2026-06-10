-- Adds nappy and medicine logs to the realtime publication so partner
-- devices receive live updates for them, matching feed_sessions.
-- RLS on both tables already restricts events to household members.

begin;

alter publication supabase_realtime add table public.nappy_logs;
alter publication supabase_realtime add table public.medicine_logs;

commit;
