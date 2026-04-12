-- RLS policies for room_users table
-- Users who right-swiped an event can see all members of that event's room,
-- and can add themselves to the room.

alter table public.room_users enable row level security;

-- SELECT: authenticated users can view members of rooms tied to events they liked
drop policy if exists "Users can view room members for events they liked" on public.room_users;
create policy "Users can view room members for events they liked"
on public.room_users
for select
to authenticated
using (
  -- User is directly in this room
  user_id = auth.uid()
  or
  -- User right-swiped on the same event as this room
  room_id in (
    select r.id
    from public.rooms r
    join public.swipes s on s.event_id = r.event_id
    where s.user_id = auth.uid()
      and s.direction = 'right'
  )
);

-- INSERT: users can add themselves to rooms for events they right-swiped
drop policy if exists "Users can join rooms for events they liked" on public.room_users;
create policy "Users can join rooms for events they liked"
on public.room_users
for insert
to authenticated
with check (
  user_id = auth.uid()
  and room_id in (
    select r.id
    from public.rooms r
    join public.swipes s on s.event_id = r.event_id
    where s.user_id = auth.uid()
      and s.direction = 'right'
  )
);
