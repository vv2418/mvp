-- Deduplicate room_users (same user joined the same room multiple times)
delete from public.room_users a
using (
  select id,
         row_number() over (partition by room_id, user_id order by joined_at asc nulls last, id) as rn
  from public.room_users
) d
where a.id = d.id
  and d.rn > 1;

create unique index if not exists room_users_room_id_user_id_key
  on public.room_users (room_id, user_id);

-- Profile fields stored in DB (replacing localStorage for bio / city)
alter table public.profiles
  add column if not exists bio text,
  add column if not exists location text;
