create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

drop policy if exists "Users can manage their own carts" on public.carts;
create policy "Users can manage their own carts"
  on public.carts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own cart items" on public.cart_items;
create policy "Users can manage their own cart items"
  on public.cart_items for all
  to authenticated
  using (
    exists (
      select 1
      from public.carts
      where carts.id = cart_items.cart_id
        and carts.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.carts
      where carts.id = cart_items.cart_id
        and carts.user_id = (select auth.uid())
    )
  );

revoke all on public.carts, public.cart_items from anon, authenticated;
grant select, insert, update, delete on public.carts to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
