import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Radio, Unlock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/RoleGate";
import { RequestCard } from "@/components/RequestCard";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ServiceRequest } from "@/lib/service-requests";

export const Route = createFileRoute("/_authenticated/mechanic-dash")({
  head: () => ({
    meta: [
      { title: "Mechanic Dashboard — Service Hub" },
      {
        name: "description",
        content:
          "Browse the live breakdown feed, unlock jobs with your wallet and complete roadside repairs for fleet drivers.",
      },
      { property: "og:title", content: "Mechanic Dashboard — Service Hub" },
      {
        property: "og:description",
        content: "Live breakdown feed and job management for verified roadside mechanics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RoleGate allow="mechanic">
      <MechanicDash />
    </RoleGate>
  ),
});

function MechanicDash() {
  const { t } = useLanguage();
  const { user, profile, refreshProfile } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [unlockFee, setUnlockFee] = useState(50);

  useEffect(() => {
    const loadFee = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "unlock_fee")
        .maybeSingle();
      if (data) setUnlockFee(Number(data.setting_value));
    };
    void loadFee();
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("service_requests")
        .select("*")
        .order("created_at", { ascending: false });
      setRequests((data as ServiceRequest[]) ?? []);
    };
    void load();

    const channel = supabase
      .channel("mechanic-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests" },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const accept = async (request: ServiceRequest) => {
    if (!user || !profile) return;
    if (profile.wallet_balance < unlockFee) {
      toast.error("Not enough wallet balance to unlock this job.");
      return;
    }
    const { error } = await supabase
      .from("service_requests")
      .update({ mechanic_id: user.id, status: "accepted", fee_paid: unlockFee })
      .eq("id", request.id)
      .eq("status", "pending");
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase
      .from("profiles")
      .update({ wallet_balance: profile.wallet_balance - unlockFee })
      .eq("id", user.id);
    await refreshProfile();
    toast.success("Job unlocked. Driver contact details revealed.");
  };

  const complete = async (request: ServiceRequest) => {
    const { error } = await supabase
      .from("service_requests")
      .update({ status: "completed" })
      .eq("id", request.id);
    if (error) toast.error(error.message);
    else toast.success("Job marked completed.");
  };

  const pending = requests.filter((r) => r.status === "pending");
  const mine = requests.filter((r) => r.mechanic_id === user?.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">{t("mechanicDash")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} label={t("balance")} value={`₹${profile?.wallet_balance ?? 0}`} />
        <StatCard icon={Unlock} label={t("unlockFee")} value={`₹${unlockFee}`} hint="per job" />
        <StatCard icon={CheckCircle2} label={t("jobs")} value={mine.length} />
      </div>

      <section className="mt-8 space-y-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Radio className="size-4 animate-pulse text-primary" />
          {t("liveFeed")}
        </h2>
        {pending.length === 0 ? (
          <p className="panel p-6 text-sm text-muted-foreground">{t("noRequests")}</p>
        ) : (
          pending.map((r) => (
            <RequestCard key={r.id} request={r}>
              <Button size="sm" className="font-semibold" onClick={() => accept(r)}>
                {t("accept")} · ₹{unlockFee}
              </Button>
            </RequestCard>
          ))
        )}
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-lg font-semibold">{t("jobs")}</h2>
        {mine.length === 0 ? (
          <p className="panel p-6 text-sm text-muted-foreground">{t("noRequests")}</p>
        ) : (
          mine.map((r) => (
            <RequestCard key={r.id} request={r}>
              {r.status === "accepted" && (
                <Button size="sm" variant="outline" onClick={() => complete(r)}>
                  {t("complete")}
                </Button>
              )}
            </RequestCard>
          ))
        )}
      </section>
    </main>
  );
}
