-- Delete user(s) identified as Tester_new (profile name and/or auth email) and related rows.

do $$
declare
  target_ids uuid[];
  n int;
begin
  select array_agg(distinct uid)
  into target_ids
  from (
    select p.id as uid
    from public.profiles p
    where trim(both from coalesce(p.name, '')) ilike 'tester_new'
    union
    select u.id as uid
    from auth.users u
    where coalesce(u.email, '') ilike '%tester_new%'
  ) t;

  if target_ids is null or cardinality(target_ids) = 0 then
    raise notice 'No user matched Tester_new (name or email) — nothing to delete.';
    return;
  end if;

  n := cardinality(target_ids);
  raise notice 'Deleting Tester_new and related data for % user(s)...', n;

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

  raise notice 'Removed % auth user(s) (Tester_new).', n;
end;
$$;
