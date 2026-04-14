-- Remove users whose display name contains "test" (case-insensitive) AND have related app data,
-- then delete all of their rows (same as other cleanup migrations).
-- Related data = swipes, room membership, human messages, interests, or push subscription.
-- Matches e.g. "Test User", "tester". Substring match can also hit names like "Contest" if they have activity.

do $$
declare
  target_ids uuid[];
  n int;
begin
  select array_agg(p.id)
  into target_ids
  from public.profiles p
  where p.name is not null
    and trim(both from p.name) ilike '%test%'
    and (
      exists (select 1 from public.swipes s where s.user_id = p.id)
      or exists (select 1 from public.room_users ru where ru.user_id = p.id)
      or exists (select 1 from public.messages m where m.user_id = p.id and m.is_ai = false)
      or exists (select 1 from public.user_interests ui where ui.user_id = p.id)
      or exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id)
    );

  if target_ids is null or cardinality(target_ids) = 0 then
    raise notice 'No profiles with "test" in name and related data — nothing to clean up.';
    return;
  end if;

  n := cardinality(target_ids);
  raise notice 'Deleting data for % user(s) with "test" in profile name...', n;

  delete from public.messages
  where user_id is not null
    and user_id = any(target_ids);

  delete from public.push_subscriptions
  where user_id = any(target_ids);

  delete from public.room_users
  where user_id = any(target_ids);

  delete from public.swipes
  where user_id = any(target_ids);

  delete from public.user_interests
  where user_id = any(target_ids);

  delete from public.profiles
  where id = any(target_ids);

  delete from public.rooms
  where id not in (select distinct room_id from public.room_users)
    and id not in (
      select distinct room_id from public.messages where is_ai = false
    );

  delete from public.messages
  where room_id not in (select id from public.rooms);

  delete from auth.users
  where id = any(target_ids);

  raise notice 'Cleanup complete — removed % auth user(s).', n;
end;
$$;
