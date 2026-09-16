-- Ralvessura initial schema.
--
-- Security model: the user ID is the secret used by the /gerir/{uuid} management link.
-- Therefore, anon must never read `pins.user_id`: a public SELECT policy on `pins`
-- would reveal every management link. All access uses SECURITY DEFINER RPCs, and
-- direct table access is denied to anon.

create table public.users (
  id         uuid primary key default gen_random_uuid(), -- Management secret
  name       text not null check (char_length(name) between 1 and 100),
  email      text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
revoke all on table public.users from anon, authenticated;

create table public.pins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  address    text not null,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  date       date not null,
  start_time time not null,
  end_time   time not null check (end_time > start_time),
  sweets     text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.pins enable row level security;
revoke all on table public.pins from anon, authenticated;
create index pins_date_idx on public.pins (date);

-- Public map data excludes user_id and pins from previous years.
create or replace function public.get_public_pins()
returns table (
  id uuid,
  name text,
  address text,
  lat double precision,
  lng double precision,
  date date,
  start_time time,
  end_time time,
  sweets text[],
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, address, lat, lng, date, start_time, end_time, sweets, created_at
  from public.pins
  where date >= date_trunc('year', now())::date
  order by date, start_time;
$$;

-- Management page data verifies the secret and returns the user with their pins.
-- Always returns exactly one jsonb value.
create or replace function public.get_my_data(p_secret uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'found', true,
      'name', u.name,
      'email', u.email,
      'pins', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'address', p.address,
          'lat', p.lat,
          'lng', p.lng,
          'date', p.date,
          'start_time', p.start_time,
          'end_time', p.end_time,
          'sweets', to_jsonb(p.sweets),
          'created_at', p.created_at
        ) order by p.date, p.start_time)
        from public.pins p
        where p.user_id = u.id
      ), '[]'::jsonb)
    )
    from public.users u
    where u.id = p_secret
  ), '{"found": false}'::jsonb);
$$;

-- Add or edit a pin (a null p_pin_id creates one). The secret verifies ownership.
-- Missing users and pins owned by another user both raise invalid_secret.
create or replace function public.upsert_pin(
  p_secret uuid,
  p_pin_id uuid,
  p_name text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_sweets text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_pin_id uuid;
begin
  select id into v_user_id from public.users where id = p_secret;
  if v_user_id is null then
    raise exception 'invalid_secret';
  end if;

  if p_end_time <= p_start_time then
    raise exception 'invalid_times';
  end if;

  if p_pin_id is not null then
    select id into v_pin_id from public.pins where id = p_pin_id and user_id = v_user_id;
    if v_pin_id is null then
      raise exception 'invalid_secret';
    end if;
  else
    v_pin_id := gen_random_uuid();
  end if;

  insert into public.pins (id, user_id, name, address, lat, lng, date, start_time, end_time, sweets)
  values (v_pin_id, v_user_id, p_name, p_address, p_lat, p_lng, p_date, p_start_time, p_end_time, p_sweets)
  on conflict (id) do update set
    name = excluded.name,
    address = excluded.address,
    lat = excluded.lat,
    lng = excluded.lng,
    date = excluded.date,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    sweets = excluded.sweets;

  return (select to_jsonb(p) from public.pins p where p.id = v_pin_id);
end;
$$;

-- Delete a pin owned by the current secret holder.
create or replace function public.delete_pin(p_secret uuid, p_pin_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from public.users where id = p_secret;
  if v_user_id is null then
    raise exception 'invalid_secret';
  end if;

  delete from public.pins where id = p_pin_id and user_id = v_user_id;
  return found;
end;
$$;

-- Only anon may execute these RPCs; no direct table privileges are granted.
revoke execute on function public.get_public_pins() from public;
revoke execute on function public.get_my_data(uuid) from public;
revoke execute on function public.upsert_pin(uuid, uuid, text, text, double precision, double precision, date, time, time, text[]) from public;
revoke execute on function public.delete_pin(uuid, uuid) from public;

grant execute on function public.get_public_pins() to anon;
grant execute on function public.get_my_data(uuid) to anon;
grant execute on function public.upsert_pin(uuid, uuid, text, text, double precision, double precision, date, time, time, text[]) to anon;
grant execute on function public.delete_pin(uuid, uuid) to anon;
