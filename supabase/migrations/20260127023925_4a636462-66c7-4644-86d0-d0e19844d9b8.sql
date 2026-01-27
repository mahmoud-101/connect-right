-- SellFast MVP schema

-- 1) Shared updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2) Profiles (store app-level user info)
create table if not exists public.profiles (
  user_id uuid primary key,
  full_name text,
  language text not null default 'ar',
  subscription_plan text not null default 'free',
  extraction_limit int not null default 10,
  monthly_extractions int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

alter table public.profiles enable row level security;

create policy "Profiles: users can read own"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Profiles: users can insert own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Profiles: users can update own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 3) Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Trigger lives on auth.users (safe)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 4) Extracted products
create table if not exists public.extracted_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_url text not null,
  product_title text,
  product_image_urls text[] not null default '{}',
  original_price text,
  specs text,
  tone text not null default 'casual',
  generated_description text,
  generated_short_post text,
  generated_selling_points text[] not null default '{}',
  generated_hashtags text[] not null default '{}',
  suggested_pricing jsonb,
  is_saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extracted_products_user_fk foreign key (user_id) references public.profiles(user_id) on delete cascade
);

create index if not exists idx_extracted_products_user_created_at
on public.extracted_products (user_id, created_at desc);

create trigger trg_extracted_products_updated_at
before update on public.extracted_products
for each row execute function public.update_updated_at_column();

alter table public.extracted_products enable row level security;

create policy "Extracted products: users can read own"
on public.extracted_products
for select
to authenticated
using (auth.uid() = user_id);

create policy "Extracted products: users can insert own"
on public.extracted_products
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Extracted products: users can update own"
on public.extracted_products
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Extracted products: users can delete own"
on public.extracted_products
for delete
to authenticated
using (auth.uid() = user_id);

-- 5) Usage logs
create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now(),
  constraint usage_logs_user_fk foreign key (user_id) references public.profiles(user_id) on delete cascade
);

create index if not exists idx_usage_logs_user_created_at
on public.usage_logs (user_id, created_at desc);

alter table public.usage_logs enable row level security;

create policy "Usage logs: users can read own"
on public.usage_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Usage logs: users can insert own"
on public.usage_logs
for insert
to authenticated
with check (auth.uid() = user_id);

-- Typically no need for update/delete on logs; keep locked down.
