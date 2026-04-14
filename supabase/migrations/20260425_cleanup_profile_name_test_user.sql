-- Delete every user whose profile display name is exactly "Test User" (trimmed),
-- plus all related public data and the auth.users row.

do $$
declare
  target_ids uuid[];
  n int;
begin
  select array_agg(id)
  into target_ids
  from public.profiles
  where trim(both from coalesce(name, '')) = 'Test User';

  if target_ids is null or cardinality(target_ids) = 0 then
    raise notice 'No profiles named "Test User" — nothing to clean up.';
    return;
  end if;

  n := cardinality(target_ids);
  raise notice 'Deleting data for % user(s) with name Test User...', n;

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
