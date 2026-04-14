-- Returns a count of right-swipes per event across all users.
-- SECURITY DEFINER bypasses RLS so we can aggregate across all users.
-- Returns only the count, not individual user data, so privacy is maintained.
create or replace function public.get_event_swipe_counts()
returns table(event_id text, swipe_count bigint)
language sql
security definer
stable
as $$
  select event_id, count(*) as swipe_count
  from public.swipes
  where direction = 'right'
  group by event_id;
$$;
