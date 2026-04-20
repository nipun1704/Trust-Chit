-- TrustChit minimal schema for a fresh Supabase project
-- Paste into Supabase Dashboard -> SQL Editor and run.

create extension if not exists "pgcrypto";

-- User profile (linked 1:1 with Supabase Auth user)
create table if not exists public.user_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Chit groups
create table if not exists public.chit_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  monthly_contribution numeric not null,
  total_members integer not null,
  duration_months integer not null,
  status text not null default 'active',
  created_by uuid not null references public.user_profile(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Group members
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chit_groups(id) on delete cascade,
  user_id uuid not null references public.user_profile(user_id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- Notifications (group invites)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chit_groups(id) on delete cascade,
  invited_by_id uuid not null references public.user_profile(user_id) on delete cascade,
  invited_user_id uuid not null references public.user_profile(user_id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auctions
create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chit_groups(id) on delete cascade,
  round_number integer not null,
  auction_date timestamptz not null,
  deadline timestamptz not null,
  status text not null default 'open',
  winner_id uuid references public.user_profile(user_id) on delete set null,
  winner_bid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, round_number)
);

-- Bids (stored as text since code uses .toString())
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  user_id uuid not null references public.user_profile(user_id) on delete cascade,
  bid_amount text not null,
  created_at timestamptz not null default now()
);

-- Payments (stored as text since code uses .toString())
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profile(user_id) on delete cascade,
  group_id uuid not null references public.chit_groups(id) on delete cascade,
  auction_id uuid references public.auctions(id) on delete set null,
  amount text not null,
  type text not null,
  status text not null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_group_members on public.group_members;
create trigger set_updated_at_group_members
before update on public.group_members
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_notifications on public.notifications;
create trigger set_updated_at_notifications
before update on public.notifications
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_auctions on public.auctions;
create trigger set_updated_at_auctions
before update on public.auctions
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_payments on public.payments;
create trigger set_updated_at_payments
before update on public.payments
for each row execute function public.set_updated_at();

-- Minimal permissions for MVP/demo (RLS disabled)
alter table public.user_profile disable row level security;
alter table public.chit_groups disable row level security;
alter table public.group_members disable row level security;
alter table public.notifications disable row level security;
alter table public.auctions disable row level security;
alter table public.bids disable row level security;
alter table public.payments disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
