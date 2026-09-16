-- Convert persisted sweet category identifiers to English while preserving order.
update public.pins as pin
set sweets = (
  select coalesce(array_agg(converted.slug order by converted.position), '{}'::text[])
  from (
    select
      case item.value
        when 'chocolates' then 'chocolate'
        when 'gomas' then 'gummies'
        when 'rebucados' then 'hard_candy'
        when 'bolachas' then 'cookies'
        when 'salgados' then 'savory_snacks'
        when 'outros' then 'other'
        else item.value
      end as slug,
      item.position
    from unnest(pin.sweets) with ordinality as item(value, position)
  ) as converted
)
where pin.sweets && array[
  'chocolates',
  'gomas',
  'rebucados',
  'bolachas',
  'salgados',
  'outros'
]::text[];
