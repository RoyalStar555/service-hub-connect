import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, MapPin, Plus, Radio, Unlock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleGate } from "@/components/RoleGate";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ServiceRequest } from "@/lib/service-requests";

const MechanicMap = lazy(() => import("@/components/MechanicMap"));

const DEFAULT_CENTER = { lat: 19.076, lng: 72.8777 };

export const Route = createFileRoute("/_authenticated/mechanic-dash")({
  head: () => ({
    meta: [
      { title: "Mechanic Radar — Service Hub" },
      {
        name: "description",
        content:
          "Track masked breakdown zones on a live radar map, unlock exact GPS with your wallet and dispatch to fleet drivers.",
      },
      { property: "og:title", content: "Mechanic Radar — Service Hub" },
      {
        property: "og:description",
        content: "Live breakdown radar and wallet-based job unlocking for verified roadside mechanics.",
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
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [active, setActive] = useState<ServiceRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpBusy, setTopUpBusy] = useState(false);

  const addFunds = async () => {
    if (!user || !profile) return;
    setTopUpBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      const { error } = await supabase
        .from("profiles")
        .update({ wallet_balance: profile.wallet_balance + 500 })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      setTopUpOpen(false);
      toast.success("Payment successful — ₹500 added to your wallet.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed. Try again.");
    } finally {
      setTopUpBusy(false);
    }
  };


  useEffect(() => {
    const loadFee = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "unlock_fee")
        .maybeSingle();
      if (data) setUnlockFee(Number(data.setting_value) || 50);
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
      .channel("mechanic-radar")
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

  const pending = useMemo(
    () => requests.filter((r) => r.status === "pending" && r.exact_lat != null),
    [requests],
  );
  const mine = useMemo(
    () => requests.filter((r) => r.mechanic_id === user?.id),
    [requests, user?.id],
  );

  const center = pending[0]?.exact_lat
    ? { lat: pending[0].exact_lat, lng: pending[0].exact_lng as number }
    : (mine[0]?.exact_lat
        ? { lat: mine[0].exact_lat, lng: mine[0].exact_lng as number }
        : DEFAULT_CENTER);

  const unlock = async () => {
    if (!selected || !user || !profile) return;
    if (profile.wallet_balance < unlockFee) {
      toast.error("Not enough wallet balance to unlock this job.");
      return;
    }
    setBusy(true);
    try {
      const { error: walletError } = await supabase
        .from("profiles")
        .update({ wallet_balance: profile.wallet_balance - unlockFee })
        .eq("id", user.id);
      if (walletError) throw walletError;

      const { data, error } = await supabase
        .from("service_requests")
        .update({ status: "accepted", mechanic_id: user.id, fee_paid: unlockFee })
        .eq("id", selected.id)
        .eq("status", "pending")
        .select("*")
        .single();
      if (error) throw error;

      const updated = data as ServiceRequest;
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setActive(updated);
      setSelected(null);
      await refreshProfile();
      toast.success("Job unlocked. Exact GPS revealed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unlock this job.");
    } finally {
      setBusy(false);
    }
  };

  const complete = async (request: ServiceRequest) => {
    const { error } = await supabase
      .from("service_requests")
      .update({ status: "completed" })
      .eq("id", request.id);
    if (error) toast.error(error.message);
    else toast.success("Job marked completed.");
  };

  const detail = active ?? mine[0] ?? null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-foreground">{t("mechanicDash")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="space-y-3">
          <StatCard icon={Wallet} label={t("balance")} value={`₹${profile?.wallet_balance ?? 0}`} />
          <Button
            className="w-full font-semibold"
            onClick={() => setTopUpOpen(true)}
          >
            <Plus className="mr-2 size-4" /> Add Funds
          </Button>
        </div>
        <StatCard icon={Unlock} label={t("unlockFee")} value={`₹${unlockFee}`} hint="per job" />
        <StatCard icon={CheckCircle2} label={t("jobs")} value={mine.length} />
      </div>


      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-md">
          <div className="flex items-center gap-2 px-4 py-3">
            <Radio className="size-4 animate-pulse text-primary" />
            <h2 className="font-display text-lg font-semibold">{t("liveFeed")}</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {pending.length} {t("pending").toLowerCase()}
            </span>
          </div>
          <div className="h-[480px] overflow-hidden rounded-2xl">
            <ClientOnly
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Loading map…
                </div>
              }
            >
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" /> Loading map…
                  </div>
                }
              >
                <MechanicMap
                  center={center}
                  pending={pending}
                  unlocked={mine.filter((r) => r.status !== "completed")}
                  onSelect={(r) => (r.status === "pending" ? setSelected(r) : setActive(r))}
                />
              </Suspense>
            </ClientOnly>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-md">
          <h2 className="font-display text-xl font-semibold">{t("jobs")}</h2>
          {!detail ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("noRequests")}</p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("vehicleType")}
                </p>
                <p className="font-medium text-foreground">{detail.vehicle_type}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("issueType")}
                </p>
                <p className="font-medium text-foreground">{detail.issue_type}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  GPS
                </p>
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <MapPin className="size-3.5 text-primary" />
                  {detail.exact_lat != null && detail.exact_lng != null
                    ? `${detail.exact_lat.toFixed(5)}, ${detail.exact_lng.toFixed(5)}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("unlockFee")}
                </p>
                <p className="font-medium text-foreground">₹{detail.fee_paid}</p>
              </div>
              <a
                className="inline-block text-xs font-semibold text-primary underline"
                href={`https://www.google.com/maps?q=${detail.exact_lat},${detail.exact_lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Navigate
              </a>
              {detail.status === "accepted" && (
                <Button size="sm" className="w-full font-semibold" onClick={() => complete(detail)}>
                  {t("complete")}
                </Button>
              )}
            </div>
          )}
        </aside>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {selected?.vehicle_type} {t("requests")}
            </DialogTitle>
            <DialogDescription>
              {selected?.vehicle_type} Breakdown. Pay ₹{unlockFee} from wallet to unlock exact GPS.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={busy}>
              Cancel
            </Button>
            <Button className="font-semibold" onClick={unlock} disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("accept")} · ₹{unlockFee}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
