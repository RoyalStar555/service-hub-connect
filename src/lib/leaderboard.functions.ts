import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildMechanicLeaderboard } from "./leaderboard.server";

export const getMechanicLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (roleRow?.role !== "mechanic" && roleRow?.role !== "admin") {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles, error: profilesError }, { data: jobs, error: jobsError }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, is_premium_badge")
        .eq("role", "mechanic")
        .eq("is_verified", true),
      supabaseAdmin
        .from("service_requests")
        .select("mechanic_id, rating")
        .eq("status", "completed")
        .not("mechanic_id", "is", null),
    ]);

    if (profilesError) throw profilesError;
    if (jobsError) throw jobsError;

    return buildMechanicLeaderboard(profiles ?? [], jobs ?? []);
  });