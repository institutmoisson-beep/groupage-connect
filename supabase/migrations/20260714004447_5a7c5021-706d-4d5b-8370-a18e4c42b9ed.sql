ALTER TABLE public.custom_sourcing_orders
  ADD COLUMN IF NOT EXISTS main_image TEXT,
  ADD COLUMN IF NOT EXISTS source_platform TEXT;