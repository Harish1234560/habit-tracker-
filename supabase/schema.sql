-- Habit Grove database schema
-- Run this whole file in Supabase Dashboard -> SQL Editor -> New query.
-- Row Level Security makes each user's records private to their own account.

create extension if not exists pgcrypto;

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'Personal',
  emoji text not null default '✨',
  color text not null default '#25865a',
  target text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;

drop policy if exists "Users can read their own habits" on public.habits;
create policy "Users can read their own habits"
on public.habits for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can create their own habits" on public.habits;
create policy "Users can create their own habits"
on public.habits for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update their own habits" on public.habits;
create policy "Users can update their own habits"
on public.habits for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own habits" on public.habits;
create policy "Users can delete their own habits"
on public.habits for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their own completions" on public.habit_completions;
create policy "Users can read their own completions"
on public.habit_completions for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can create their own completions" on public.habit_completions;
create policy "Users can create their own completions"
on public.habit_completions for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
);

drop policy if exists "Users can update their own completions" on public.habit_completions;
create policy "Users can update their own completions"
on public.habit_completions for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
);

drop policy if exists "Users can delete their own completions" on public.habit_completions;
create policy "Users can delete their own completions"
on public.habit_completions for delete to authenticated using (auth.uid() = user_id);

-- Keep updated_at current for updates.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at before update on public.habits
for each row execute function public.set_updated_at();

drop trigger if exists completions_set_updated_at on public.habit_completions;
create trigger completions_set_updated_at before update on public.habit_completions
for each row execute function public.set_updated_at();
