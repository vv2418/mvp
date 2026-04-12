-- Delete rooms that have fewer than 2 members (created before the 2-person threshold fix)
-- Cascades to messages and room_users via foreign key constraints

delete from public.messages
where room_id in (
  select r.id
  from public.rooms r
  left join public.room_users ru on ru.room_id = r.id
  group by r.id
  having count(ru.user_id) < 2
);

delete from public.room_users
where room_id in (
  select r.id
  from public.rooms r
  left join public.room_users ru on ru.room_id = r.id
  group by r.id
  having count(ru.user_id) < 2
);

delete from public.rooms
where id in (
  select r.id
  from public.rooms r
  left join public.room_users ru on ru.room_id = r.id
  group by r.id
  having count(ru.user_id) < 2
);
