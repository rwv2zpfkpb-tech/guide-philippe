-- Roadmap Schritt 2: Preis-Rating auf 0–4 erweitern (0 = kostenlos).
alter table public.restaurants
  drop constraint restaurants_price_level_check;

alter table public.restaurants
  add constraint restaurants_price_level_check check (price_level between 0 and 4);
