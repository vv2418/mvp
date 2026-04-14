-- Aggregate stats for Discover "pulse" UI (no per-user swipe rows exposed).
-- Recent activity window: last 45 minutes.

create or replace function public.get_discover_pulse_stats()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'recent_swipers', coalesce(
      (
        select count(distinct user_id)::bigint
        from public.swipes
        where direction = 'right'
          and created_at > now() - interval '45 minutes'
      ),
      0
    ),
    'right_swipes_last_24h', coalesce(
      (
        select count(*)::bigint
        from public.swipes
        where direction = 'right'
          and created_at > now() - interval '24 hours'
      ),
      0
    )
  );
$$;

grant execute on function public.get_discover_pulse_stats() to authenticated;
