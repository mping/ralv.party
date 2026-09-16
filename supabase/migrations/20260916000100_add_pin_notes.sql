-- Optional apartment detail and public instructions associated with a pin.
alter table public.pins
  add column if not exists floor_door text check (char_length(floor_door) <= 50),
  add column if not exists notes text check (char_length(notes) <= 500);

drop function public.get_public_pins();

create function public.get_public_pins()
returns table (
  id uuid,
  name text,
  address text,
  floor_door text,
  notes text,
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
  select id, name, address, floor_door, notes, lat, lng, date, start_time, end_time, sweets, created_at
  from public.pins
  where date >= date_trunc('year', now())::date
  order by date, start_time;
$$;

drop function if exists public.upsert_pin(uuid, uuid, text, text, double precision, double precision, date, time, time, text[]);
drop function if exists public.upsert_pin(uuid, uuid, text, text, text, double precision, double precision, date, time, time, text[]);

create function public.upsert_pin(
  p_secret uuid,
  p_pin_id uuid,
  p_name text,
  p_address text,
  p_floor_door text,
  p_notes text,
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

  if char_length(p_floor_door) > 50 then
    raise exception 'invalid_floor_door';
  end if;

  if char_length(p_notes) > 500 then
    raise exception 'invalid_notes';
  end if;

  if p_pin_id is not null then
    select id into v_pin_id from public.pins where id = p_pin_id and user_id = v_user_id;
    if v_pin_id is null then
      raise exception 'invalid_secret';
    end if;
  else
    v_pin_id := gen_random_uuid();
  end if;

  insert into public.pins (
    id, user_id, name, address, floor_door, notes, lat, lng, date, start_time, end_time, sweets
  )
  values (
    v_pin_id, v_user_id, p_name, p_address, nullif(p_floor_door, ''), nullif(p_notes, ''), p_lat,
    p_lng, p_date, p_start_time, p_end_time, p_sweets
  )
  on conflict (id) do update set
    name = excluded.name,
    address = excluded.address,
    floor_door = excluded.floor_door,
    notes = excluded.notes,
    lat = excluded.lat,
    lng = excluded.lng,
    date = excluded.date,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    sweets = excluded.sweets;

  return (select to_jsonb(p) from public.pins p where p.id = v_pin_id);
end;
$$;

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
          'floor_door', p.floor_door,
          'notes', p.notes,
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

revoke execute on function public.get_public_pins() from public;
revoke execute on function public.upsert_pin(uuid, uuid, text, text, text, text, double precision, double precision, date, time, time, text[]) from public;

grant execute on function public.get_public_pins() to anon;
grant execute on function public.upsert_pin(uuid, uuid, text, text, text, text, double precision, double precision, date, time, time, text[]) to anon;
