create table if not exists public.order_emails (
  order_id uuid primary key references public.orders (id) on delete cascade,
  recipient text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.order_emails enable row level security;
revoke all on public.order_emails from anon, authenticated;

create or replace function public.create_order(
  p_user_id uuid,
  p_checkout_key uuid,
  p_customer_name text,
  p_email text,
  p_phone text,
  p_delivery_address text,
  p_city text,
  p_state text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_input jsonb;
  v_product public.products%rowtype;
  v_product_id text;
  v_quantity integer;
  v_subtotal numeric(12, 2) := 0;
  v_snapshots jsonb := '[]'::jsonb;
  v_order public.orders%rowtype;
  v_snapshot record;
begin
  if p_user_id is null
    or p_checkout_key is null
    or length(btrim(coalesce(p_customer_name, ''))) not between 2 and 120
    or length(btrim(coalesce(p_email, ''))) not between 3 and 254
    or position('@' in p_email) < 2
    or length(btrim(coalesce(p_phone, ''))) not between 7 and 25
    or length(btrim(coalesce(p_delivery_address, ''))) not between 5 and 300
    or length(btrim(coalesce(p_city, ''))) not between 2 and 100
    or length(btrim(coalesce(p_state, ''))) not between 2 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_DETAILS';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_ITEMS';
  end if;

  if jsonb_array_length(p_items) not between 1 and 30 then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_ITEMS';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || p_checkout_key::text, 0)
  );

  select * into v_order
  from public.orders
  where user_id = p_user_id
    and checkout_key = p_checkout_key;

  if found then
    return jsonb_build_object(
      'order', to_jsonb(v_order),
      'items', (
        select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at), '[]'::jsonb)
        from public.order_items as item
        where item.order_id = v_order.id
      ),
      'is_existing', true,
      'email_status', (
        select email_record.status
        from public.order_emails as email_record
        where email_record.order_id = v_order.id
      ),
      'email_attempts', (
        select email_record.attempts
        from public.order_emails as email_record
        where email_record.order_id = v_order.id
      )
    );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as entry(value)
    where jsonb_typeof(entry.value) is distinct from 'object'
      or nullif(btrim(entry.value ->> 'productId'), '') is null
      or coalesce(entry.value ->> 'quantity', '') !~ '^(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20)$'
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_ITEMS';
  end if;

  if exists (
    select entry.value ->> 'productId'
    from jsonb_array_elements(p_items) as entry(value)
    group by entry.value ->> 'productId'
    having count(*) > 1
  ) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_ORDER_ITEMS';
  end if;

  for v_input in
    select entry.value
    from jsonb_array_elements(p_items) as entry(value)
    order by entry.value ->> 'productId'
  loop
    v_product_id := btrim(v_input ->> 'productId');
    v_quantity := (v_input ->> 'quantity')::integer;

    select product.* into v_product
    from public.products as product
    where product.id = v_product_id
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
    end if;

    if v_product.archived_at is not null or not v_product.is_available then
      raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_AVAILABLE';
    end if;

    if v_product.stock_quantity < v_quantity then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK';
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
    v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_title', v_product.title,
      'unit_price', v_product.price,
      'quantity', v_quantity,
      'subtotal', v_product.price * v_quantity
    ));
  end loop;

  insert into public.orders (
    user_id, checkout_key, customer_name, email, phone, delivery_address, city, state,
    subtotal, shipping_fee, total, status
  ) values (
    p_user_id, p_checkout_key, btrim(p_customer_name), lower(btrim(p_email)), btrim(p_phone),
    btrim(p_delivery_address), btrim(p_city), btrim(p_state),
    v_subtotal, 0, v_subtotal, 'pending'
  )
  returning * into v_order;

  for v_snapshot in
    select *
    from jsonb_to_recordset(v_snapshots) as snapshot(
      product_id text,
      product_title text,
      unit_price numeric,
      quantity integer,
      subtotal numeric
    )
  loop
    update public.products
    set stock_quantity = stock_quantity - v_snapshot.quantity,
        updated_at = now()
    where id = v_snapshot.product_id
      and stock_quantity >= v_snapshot.quantity;

    if not found then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK';
    end if;

    insert into public.order_items (
      order_id, product_id, product_title, unit_price, quantity, subtotal
    ) values (
      v_order.id, v_snapshot.product_id, v_snapshot.product_title,
      v_snapshot.unit_price, v_snapshot.quantity, v_snapshot.subtotal
    );
  end loop;

  insert into public.order_emails (order_id, recipient)
  values (v_order.id, v_order.email);

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'items', v_snapshots,
    'is_existing', false,
    'email_status', 'pending',
    'email_attempts', 0
  );
end;
$$;

revoke all on function public.create_order(uuid, uuid, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, uuid, text, text, text, text, text, text, jsonb)
  to service_role;
