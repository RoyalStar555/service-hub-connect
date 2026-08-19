ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS rating integer,
  ADD COLUMN IF NOT EXISTS feedback text;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium_badge boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.mechanic_leaderboard
WITH (security_invoker = off) AS
SELECT
  p.id,
  p.full_name,
  p.is_premium_badge,
  COALESCE(j.completed_jobs, 0)::int AS completed_jobs,
  COALESCE(j.avg_rating, 0)::numeric AS avg_rating,
  (COALESCE(j.avg_rating, 0) * log(10, COALESCE(j.completed_jobs, 0) + 1)
    * CASE WHEN p.is_premium_badge THEN 1.2 ELSE 1 END)::numeric AS score
FROM public.profiles p
LEFT JOIN (
  SELECT mechanic_id,
         count(*) AS completed_jobs,
         avg(rating) FILTER (WHERE rating IS NOT NULL) AS avg_rating
  FROM public.service_requests
  WHERE status = 'completed' AND mechanic_id IS NOT NULL
  GROUP BY mechanic_id
) j ON j.mechanic_id = p.id
WHERE p.role = 'mechanic' AND p.is_verified = true;

GRANT SELECT ON public.mechanic_leaderboard TO authenticated;