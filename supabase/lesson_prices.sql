alter table public.level_prices add column if not exists price_45 integer;
alter table public.level_prices add column if not exists price_90 integer;

alter table public.level_prices drop constraint if exists level_prices_price_45_check;
alter table public.level_prices drop constraint if exists level_prices_price_90_check;

alter table public.level_prices
  add constraint level_prices_price_45_check
  check (price_45 is null or (price_45 >= 0 and price_45 <= 100000));

alter table public.level_prices
  add constraint level_prices_price_90_check
  check (price_90 is null or (price_90 >= 0 and price_90 <= 100000));
