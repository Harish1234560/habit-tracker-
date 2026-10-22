-- WinterArc Challenge: two authorized participants with shared challenge visibility.
-- 1) Create exactly two users in Supabase Auth first.
-- 2) Run this schema, then insert the two auth.users UUIDs into challenge_members.
-- 3) Disable public sign-ups. Never put a service-role key in frontend code.
-- Usernames are stored here; passwords are securely managed by Supabase Auth.
-- The app maps each username to <lowercase-username>@winterarc.invalid for sign-in.

create extension if not exists pgcrypto;

create table if not exists public.challenge_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  username text not null check (char_length(username) between 3 and 32),
  created_at timestamptz not null default now()
);

alter table public.challenge_members add column if not exists username text;
create unique index if not exists challenge_members_username_idx
  on public.challenge_members (lower(username))
  where username is not null;

create or replace function public.is_winterarc_member(member_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.challenge_members cm where cm.user_id = member_id); $$;
revoke all on function public.is_winterarc_member(uuid) from public;
grant execute on function public.is_winterarc_member(uuid) to authenticated;

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'Personal',
  emoji text not null default '✨',
  color text not null default '#25865a',
  target text not null default '',
  cadence text not null default 'daily' check (cadence in ('daily','weekly','ongoing')),
  weekly_target integer not null default 3 check (weekly_target between 1 and 7),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.habits add column if not exists cadence text not null default 'daily';
alter table public.habits add column if not exists weekly_target integer not null default 3;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'habits_cadence_check') then
    alter table public.habits add constraint habits_cadence_check check (cadence in ('daily','weekly','ongoing'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'habits_weekly_target_check') then
    alter table public.habits add constraint habits_weekly_target_check check (weekly_target between 1 and 7);
  end if;
end $$;

create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  completion_date date not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habit_completions_one_per_day unique (habit_id, completion_date)
);

create index if not exists habits_user_sort_idx on public.habits(user_id, sort_order, created_at);
create index if not exists completions_user_date_idx on public.habit_completions(user_id, completion_date);
create index if not exists completions_habit_date_idx on public.habit_completions(habit_id, completion_date);

alter table public.challenge_members enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;

drop policy if exists "WinterArc members can view participants" on public.challenge_members;
create policy "WinterArc members can view participants" on public.challenge_members
for select to authenticated using (public.is_winterarc_member(auth.uid()));

-- Both authorized participants can see both people's habits. Only the owner manages habit definitions.
drop policy if exists "Users can read their own habits" on public.habits;
drop policy if exists "WinterArc members can view all challenge habits" on public.habits;
create policy "WinterArc members can view all challenge habits" on public.habits
for select to authenticated using (public.is_winterarc_member(auth.uid()) and public.is_winterarc_member(user_id));
drop policy if exists "Users can create their own habits" on public.habits;
create policy "Users can create their own habits" on public.habits
for insert to authenticated with check (auth.uid() = user_id and public.is_winterarc_member(auth.uid()));
drop policy if exists "Users can update their own habits" on public.habits;
create policy "Users can update their own habits" on public.habits
for update to authenticated using (auth.uid() = user_id and public.is_winterarc_member(auth.uid()))
with check (auth.uid() = user_id and public.is_winterarc_member(auth.uid()));
drop policy if exists "Users can delete their own habits" on public.habits;
create policy "Users can delete their own habits" on public.habits
for delete to authenticated using (auth.uid() = user_id and public.is_winterarc_member(auth.uid()));

-- Participants can view shared completion status, but only each habit owner can change it.
drop policy if exists "Users can read their own completions" on public.habit_completions;
drop policy if exists "WinterArc members can view challenge completions" on public.habit_completions;
create policy "WinterArc members can view challenge completions" on public.habit_completions
for select to authenticated using (public.is_winterarc_member(auth.uid()) and public.is_winterarc_member(user_id));
drop policy if exists "Users can create their own completions" on public.habit_completions;
drop policy if exists "WinterArc members can check challenge tasks" on public.habit_completions;
create policy "Users can create their own completions" on public.habit_completions
for insert to authenticated with check (
  auth.uid() = user_id
  and public.is_winterarc_member(auth.uid())
  and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
);
drop policy if exists "Users can update their own completions" on public.habit_completions;
drop policy if exists "WinterArc members can update challenge completions" on public.habit_completions;
create policy "Users can update their own completions" on public.habit_completions
for update to authenticated using (auth.uid() = user_id and public.is_winterarc_member(auth.uid()))
with check (
  auth.uid() = user_id
  and public.is_winterarc_member(auth.uid())
  and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
);
drop policy if exists "Users can delete their own completions" on public.habit_completions;
drop policy if exists "WinterArc members can delete challenge completions" on public.habit_completions;
create policy "Users can delete their own completions" on public.habit_completions
for delete to authenticated using (
  auth.uid() = user_id
  and public.is_winterarc_member(auth.uid())
  and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at before update on public.habits for each row execute function public.set_updated_at();
drop trigger if exists completions_set_updated_at on public.habit_completions;
create trigger completions_set_updated_at before update on public.habit_completions for each row execute function public.set_updated_at();

-- In Authentication > Users create:
--   harish@winterarc.invalid  (set Harish's password in Supabase Auth)
--   shyam@winterarc.invalid   (set SHYAM's password in Supabase Auth)
-- Then add the auth user UUIDs here; never store passwords in this table:
-- insert into public.challenge_members (user_id, display_name, username) values
-- ('FIRST-AUTH-USER-UUID', 'Harish', 'Harish'),
-- ('SECOND-AUTH-USER-UUID', 'SHYAM', 'SHYAM');
