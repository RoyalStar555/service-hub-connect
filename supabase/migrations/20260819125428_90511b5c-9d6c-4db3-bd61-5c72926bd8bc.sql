DROP VIEW IF EXISTS public.mechanic_leaderboard;

CREATE OR REPLACE FUNCTION public.get_mechanic_leaderboard()
RETURNS TABLE (
  id uuid,
  full_name text,
  is_premium_badge boolean,
  completed_jobs integer,
  avg_rating numeric,
  score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.is_premium_badge,
    COALESCE(j.completed_jobs, 0)::int,
    ROUND(COALESCE(j.avg_rating, 0)::numeric, 2),
    ROUND((COALESCE(j.avg_rating, 0) * log(10, COALESCE(j.completed_jobs, 0) + 1)
      * CASE WHEN p.is_premium_badge THEN 1.2 ELSE 1 END)::numeric, 3)
  FROM public.profiles p
  LEFT JOIN (
    SELECT mechanic_id,
           count(*) AS completed_jobs,
           avg(rating) FILTER (WHERE rating IS NOT NULL) AS avg_rating
    FROM public.service_requests
    WHERE status = 'completed' AND mechanic_id IS NOT NULL
    GROUP BY mechanic_id
  ) j ON j.mechanic_id = p.id
  WHERE p.role = 'mechanic' AND p.is_verified = true
  ORDER BY 6 DESC;
$$;

REVOKE ALL ON FUNCTION public.get_mechanic_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mechanic_leaderboard() TO authenticated;