-- Remove all seeded / E2E test users and every piece of data they generated.
-- Patterns covered:
--   seed_*@test.rekindled.app  (from scripts/seed-users.mjs)
--   *@phone.rekindled.app      (from Playwright auth tests — phone signups)

do $$
declare
  test_user_ids uuid[];
begin
  -- Collect all test user IDs from auth.users
  select array_agg(id)
  into test_user_ids
  from auth.users
  where email like 'seed\_%@test.rekindled.app' escape '\'
     or email like '%@phone.rekindled.app';

  if test_user_ids is null or array_length(test_user_ids, 1) = 0 then
    raise notice 'No test users found — nothing to clean up.';
    return;
  end if;

  raise notice 'Deleting data for % test user(s)...', array_length(test_user_ids, 1);

  -- Remove room memberships
  delete from public.room_users where user_id = any(test_user_ids);

  -- Remove swipes
  delete from public.swipes where user_id = any(test_user_ids);

  -- Remove interests
  delete from public.user_interests where user_id = any(test_user_ids);

  -- Remove profiles
  delete from public.profiles where id = any(test_user_ids);

  -- Remove rooms that now have zero members AND zero non-AI messages
  -- (i.e. rooms that only existed for these test users)
  delete from public.rooms
  where id not in (select distinct room_id from public.room_users)
    and id not in (
      select distinct room_id from public.messages where is_ai = false
    );

  -- Remove messages in rooms that just got deleted (cascade would handle it,
  -- but if ON DELETE CASCADE is not set, clean up manually)
  delete from public.messages
  where room_id not in (select id from public.rooms);

  -- Delete the auth users themselves
  delete from auth.users where id = any(test_user_ids);

  raise notice 'Cleanup complete.';
end;
$$;
