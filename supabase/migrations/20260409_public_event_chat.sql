-- Public read-only event chats:
-- - any authenticated user can view rooms/messages
-- - only users who liked the underlying event can insert non-AI messages

alter table public.rooms enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Authenticated users can view event rooms" on public.rooms;
create policy "Authenticated users can view event rooms"
on public.rooms
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can view event messages" on public.messages;
create policy "Authenticated users can view event messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.rooms r
    where r.id = messages.room_id
  )
);

drop policy if exists "Liked users can post into event chat" on public.messages;
create policy "Liked users can post into event chat"
on public.messages
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and is_ai = false
  and exists (
    select 1
    from public.rooms r
    join public.swipes s
      on s.event_id = r.event_id
    where r.id = messages.room_id
      and s.user_id = auth.uid()
      and s.direction = 'right'
  )
);
