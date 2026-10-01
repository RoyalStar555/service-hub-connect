type MechanicProfileRow = {
  id: string;
  full_name: string | null;
  is_premium_badge: boolean;
};

type CompletedJobRow = {
  mechanic_id: string | null;
  rating: number | null;
};

export type MechanicLeaderboardRow = MechanicProfileRow & {
  completed_jobs: number;
  avg_rating: number;
  score: number;
};

export function buildMechanicLeaderboard(
  profiles: MechanicProfileRow[],
  jobs: CompletedJobRow[],
): MechanicLeaderboardRow[] {
  const stats = new Map<string, { completedJobs: number; ratings: number[] }>();

  jobs.forEach((job) => {
    if (!job.mechanic_id) return;
    const current = stats.get(job.mechanic_id) ?? { completedJobs: 0, ratings: [] };
    current.completedJobs += 1;
    if (job.rating != null) current.ratings.push(Number(job.rating));
    stats.set(job.mechanic_id, current);
  });

  return profiles
    .map((profile) => {
      const current = stats.get(profile.id) ?? { completedJobs: 0, ratings: [] };
      const avgRating = current.ratings.length
        ? current.ratings.reduce((sum, rating) => sum + rating, 0) / current.ratings.length
        : 0;
      const score =
        avgRating * Math.log10(current.completedJobs + 1) * (profile.is_premium_badge ? 1.2 : 1);
      return {
        ...profile,
        completed_jobs: current.completedJobs,
        avg_rating: Number(avgRating.toFixed(2)),
        score: Number(score.toFixed(3)),
      };
    })
    .sort((a, b) => b.score - a.score);
}