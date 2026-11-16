ALTER TABLE public.work_zones
  ADD COLUMN IF NOT EXISTS shape text NOT NULL DEFAULT 'circle',
  ADD COLUMN IF NOT EXISTS polygon jsonb,
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

ALTER TABLE public.work_zones DROP CONSTRAINT IF EXISTS work_zones_shape_check;
ALTER TABLE public.work_zones ADD CONSTRAINT work_zones_shape_check
  CHECK (
    (shape = 'circle' AND latitude IS NOT NULL AND longitude IS NOT NULL AND radius_meters IS NOT NULL)
    OR (shape = 'polygon' AND polygon IS NOT NULL AND jsonb_array_length(polygon) >= 3)
  );