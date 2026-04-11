alter table public.profiles enable row level security;
alter table public.swipes enable row level security;
alter table public.user_interests enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can manage their own swipes" on public.swipes;
create policy "Users can manage their own swipes"
on public.swipes
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own interests" on public.user_interests;
create policy "Users can manage their own interests"
on public.user_interests
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
