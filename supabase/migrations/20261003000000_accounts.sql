-- Lumen: user accounts and cloud data storage.
-- Run once in the Supabase SQL editor (or with `supabase db push`).
--
-- Security model: the browser talks to the database directly with the publishable (anon)
-- key. Row Level Security makes every row visible and writable only by its owner.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text not null default '' check (char_length(display_name) <= 40),
  currency        text not null default 'USD' check (currency in ('USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD')),
  opening_balance numeric(14, 2) not null default 0 check (opening_balance >= 0 and opening_balance < 1000000000000),
  monthly_budget  numeric(14, 2) not null default 0 check (monthly_budget >= 0 and monthly_budget < 1000000000000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type        text not null check (type in ('income', 'expense')),
  name        text not null check (char_length(name) between 1 and 60),
  amount      numeric(12, 2) not null check (amount > 0 and amount <= 10000000),
  category    text not null check (char_length(category) between 1 and 40),
  date        date not null check (date between '1900-01-01' and '2100-12-31'),
  description text not null default '' check (char_length(description) <= 200),
  is_sample   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;

-- `(select auth.uid())` is evaluated once per query instead of once per row.
drop policy if exists "Profiles: owner can read" on public.profiles;
create policy "Profiles: owner can read"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Profiles: owner can insert" on public.profiles;
create policy "Profiles: owner can insert"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Profiles: owner can update" on public.profiles;
create policy "Profiles: owner can update"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Transactions: owner can read" on public.transactions;
create policy "Transactions: owner can read"
  on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Transactions: owner can insert" on public.transactions;
create policy "Transactions: owner can insert"
  on public.transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Transactions: owner can update" on public.transactions;
create policy "Transactions: owner can update"
  on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Transactions: owner can delete" on public.transactions;
create policy "Transactions: owner can delete"
  on public.transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Signed-out visitors get no access at all; signed-in users get only what RLS allows.
revoke all on public.profiles, public.transactions from anon;
revoke all on public.profiles, public.transactions from authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- Create an empty profile for every new account (no demo data).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), ''), 40)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Only the trigger should run this.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
