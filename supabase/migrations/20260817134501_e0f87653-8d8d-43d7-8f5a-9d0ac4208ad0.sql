ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS breakdown_address text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS customer_note text,
  ADD COLUMN IF NOT EXISTS media_url text;