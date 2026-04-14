-- users_share_room must see all room_users rows when evaluating co-membership.
-- When evaluated under RLS as the invoker, a plain SELECT on room_users only returns
-- rows visible to the invoker, so the join fails for room-mates and profile reads break.
-- SECURITY DEFINER with postgres owner runs the inner query with privileges that bypass RLS.

create or replace function public.users_share_room(uid1 uuid, uid2 uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.room_users ru1
    join public.room_users ru2 on ru1.room_id = ru2.room_id
    where ru1.user_id = uid1
      and ru2.user_id = uid2
  );
$$;

alter function public.users_share_room(uuid, uuid) owner to postgres;

revoke all on function public.users_share_room(uuid, uuid) from public;
grant execute on function public.users_share_room(uuid, uuid) to authenticated;
grant execute on function public.users_share_room(uuid, uuid) to service_role;
