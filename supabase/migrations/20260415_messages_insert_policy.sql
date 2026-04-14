-- Broaden messages INSERT to accept room_users membership as well as a right swipe.
-- Previously only right-swipers could post; now anyone in room_users can also post.

drop policy if exists "Liked users can post into event chat" on public.messages;
create policy "Room participants can post into event chat"
on public.messages
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and is_ai = false
  and (
    -- User right-swiped the event
    exists (
      select 1
      from public.rooms r
      join public.swipes s
        on s.event_id = r.event_id
      where r.id = messages.room_id
        and s.user_id = auth.uid()
        and s.direction = 'right'
    )
    or
    -- User is explicitly a room member (added by matchmaking / ensure-room)
    exists (
      select 1
      from public.room_users ru
      where ru.room_id = messages.room_id
        and ru.user_id = auth.uid()
    )
  )
);
