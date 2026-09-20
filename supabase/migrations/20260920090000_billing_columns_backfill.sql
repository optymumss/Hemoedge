-- Backfills the local migration history for four columns that were
-- applied directly to the live database at some point without a
-- corresponding migration file ever being written: organizations.tier_id,
-- organizations.stripe_customer_id, tiers.stripe_price_id_monthly, and
-- tiers.stripe_price_id_yearly. All four already exist live and are
-- already reflected in src/lib/supabase/database.types.ts -- this
-- migration only makes a fresh environment built from this folder match
-- reality. `if not exists` makes it a no-op against the live database.
alter table public.organizations
  add column if not exists stripe_customer_id text,
  add column if not exists tier_id uuid references public.tiers(id);

alter table public.tiers
  add column if not exists stripe_price_id_monthly text,
  add column if not exists stripe_price_id_yearly text;
