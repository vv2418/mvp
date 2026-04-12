-- SECURITY DEFINER helper: returns true if two users share at least one room
-- Bypasses RLS so the profiles policy can check cross-user membership safely
create or replace function public.users_share_room(uid1 uuid, uid2 uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.room_users ru1
    join public.room_users ru2 on ru1.room_id = ru2.room_id
    where ru1.user_id = uid1 and ru2.user_id = uid2
  );
$$;

-- Replace the swipes-join profile policy with one that uses the safe helper
drop policy if exists "Users can read profiles of room-mates" on public.profiles;
create policy "Users can read profiles of room-mates"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or
  public.users_share_room(auth.uid(), profiles.id)
);

-- Replace the swipes-join interests policy similarly
drop policy if exists "Users can read interests of room-mates" on public.user_interests;
create policy "Users can read interests of room-mates"
on public.user_interests
for select
to authenticated
using (
  user_id = auth.uid()
  or
  public.users_share_room(auth.uid(), user_interests.user_id)
);
