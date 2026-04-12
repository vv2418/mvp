-- Email notification preference on profiles
alter table public.profiles
  add column if not exists email_notifications boolean not null default true;

-- Track last-read timestamp per room so we can show an unread badge
alter table public.room_users
  add column if not exists last_read_at timestamptz not null default now();
