alter table public.profiles
  add column if not exists role text not null default 'customer'
  check (role in ('customer', 'admin'));

alter table public.products
  add column if not exists is_available boolean not null default true,
  add column if not exists archived_at timestamptz;

create index if not exists products_active_idx
  on public.products (is_available, title)
  where archived_at is null;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated, service_role;

drop policy if exists "Products are readable by everyone" on public.products;
create policy "Active catalog products are readable by everyone"
  on public.products for select
  to anon, authenticated
  using (archived_at is null);

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products for all
  to authenticated
  using ((select public.is_current_user_admin()))
  with check ((select public.is_current_user_admin()));

drop policy if exists "Admins can read all orders" on public.orders;
create policy "Admins can read all orders"
  on public.orders for select
  to authenticated
  using ((select public.is_current_user_admin()));

drop policy if exists "Admins can update order status" on public.orders;
create policy "Admins can update order status"
  on public.orders for update
  to authenticated
  using ((select public.is_current_user_admin()))
  with check ((select public.is_current_user_admin()));

drop policy if exists "Admins can read all order items" on public.order_items;
create policy "Admins can read all order items"
  on public.order_items for select
  to authenticated
  using ((select public.is_current_user_admin()));

grant insert, update, delete on public.products to authenticated;
grant update (status, updated_at) on public.orders to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Book covers are publicly readable" on storage.objects;
create policy "Book covers are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'book-covers');

drop policy if exists "Admins can manage book covers" on storage.objects;
create policy "Admins can manage book covers"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'book-covers' and (select public.is_current_user_admin()))
  with check (bucket_id = 'book-covers' and (select public.is_current_user_admin()));
