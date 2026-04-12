-- Allow users to read profiles of other users who share a room with them
-- (i.e., both swiped right on the same event)

drop policy if exists "Users can read profiles of room-mates" on public.profiles;
create policy "Users can read profiles of room-mates"
on public.profiles
for select
to authenticated
using (
  -- Own profile
  auth.uid() = id
  or
  -- A room-mate: the profile owner and the viewer both swiped right on some common event
  exists (
    select 1
    from public.swipes s1
    join public.swipes s2
      on s1.event_id = s2.event_id
    where s1.user_id = auth.uid()
      and s1.direction = 'right'
      and s2.user_id = profiles.id
      and s2.direction = 'right'
  )
);

-- Also allow users to read interests of room-mates (Chat.tsx member panel)
drop policy if exists "Users can read interests of room-mates" on public.user_interests;
create policy "Users can read interests of room-mates"
on public.user_interests
for select
to authenticated
using (
  user_id = auth.uid()
  or
  exists (
    select 1
    from public.swipes s1
    join public.swipes s2
      on s1.event_id = s2.event_id
    where s1.user_id = auth.uid()
      and s1.direction = 'right'
      and s2.user_id = user_interests.user_id
      and s2.direction = 'right'
  )
);
