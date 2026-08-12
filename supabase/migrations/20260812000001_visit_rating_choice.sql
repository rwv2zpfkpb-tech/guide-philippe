-- Repeat visits may either keep the restaurant's current rating or explicitly
-- assign a new one. Existing reviews all came from the old rating-per-review
-- editor, so they count as explicitly rated.
alter table public.restaurant_reviews
  add column if not exists rating_changed boolean not null default true;

-- restaurants.spoon_rating is the chronologically latest rating that was
-- explicitly assigned. A visit that merely keeps the rating must not become
-- the source of truth when a different review is edited or deleted later.
create or replace function public.sync_restaurant_spoon_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant_id uuid;
  latest_rating smallint;
begin
  target_restaurant_id := coalesce(new.restaurant_id, old.restaurant_id);

  select spoon_rating into latest_rating
  from public.restaurant_reviews
  where restaurant_id = target_restaurant_id
    and rating_changed = true
  order by visited_at desc, created_at desc
  limit 1;

  if latest_rating is not null then
    update public.restaurants
    set spoon_rating = latest_rating
    where id = target_restaurant_id;
  end if;

  return coalesce(new, old);
end;
$$;
