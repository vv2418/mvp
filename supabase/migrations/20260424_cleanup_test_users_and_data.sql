-- Remove test / seed users and all public data tied to them.
-- Matches:
--   *@test.rekindled.app          (historical seed_* pattern lives here)
--   *@phone.rekindled.app         (phone sign-up synthetic emails from Signup.tsx)
--   *@rekindle.app               (seed-rooms edge function personas — not production Gmail users)

do $$
declare
  test_user_ids uuid[];
  n int;
begin
  select array_agg(id)
  into test_user_ids
  from auth.users
  where coalesce(email, '') ilike '%@test.rekindled.app'
     or coalesce(email, '') ilike '%@phone.rekindled.app'
     or coalesce(email, '') ilike '%@rekindle.app';

  if test_user_ids is null or cardinality(test_user_ids) = 0 then
    raise notice 'No test users matched — nothing to clean up.';
    return;
  end if;

  n := cardinality(test_user_ids);
  raise notice 'Deleting data for % test user(s)...', n;

  delete from public.messages
  where user_id is not null
    and user_id = any(test_user_ids);

  delete from public.push_subscriptions
  where user_id = any(test_user_ids);

  delete from public.room_users
  where user_id = any(test_user_ids);

  delete from public.swipes
  where user_id = any(test_user_ids);

  delete from public.user_interests
  where user_id = any(test_user_ids);

  delete from public.profiles
  where id = any(test_user_ids);

  -- Rooms with no members and no human-authored messages
  delete from public.rooms
  where id not in (select distinct room_id from public.room_users)
    and id not in (
      select distinct room_id from public.messages where is_ai = false
    );

  delete from public.messages
  where room_id not in (select id from public.rooms);

  delete from auth.users
  where id = any(test_user_ids);

  raise notice 'Cleanup complete — removed % auth user(s).', n;
end;
$$;
