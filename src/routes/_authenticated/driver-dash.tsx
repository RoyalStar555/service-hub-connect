import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LocateFixed, Truck, Wallet, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGate } from "@/components/RoleGate";
import { RequestCard } from "@/components/RequestCard";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { ISSUE_TYPES, VEHICLE_TYPES, type ServiceRequest } from "@/lib/service-requests";

export const Route = createFileRoute("/_authenticated/driver-dash")({
  head: () => ({
    meta: [
      { title: "Driver Dashboard — Service Hub" },
      {
        name: "description",
        content:
          "Raise a roadside assistance request with exact GPS location and track mechanic dispatch in real time.",
      },
      { property: "og:title", content: "Driver Dashboard — Service Hub" },
      {
        property: "og:description",
        content: "Raise and track commercial vehicle breakdown requests in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RoleGate allow="driver">
      <DriverDash />
    </RoleGate>
  ),
});

function DriverDash() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [vehicleType, setVehicleType] = useState("");
  const [issueType, setIssueType] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("service_requests")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false });
      setRequests((data as ServiceRequest[]) ?? []);
    };
    void load();

    const channel = supabase
      .channel("driver-requests")
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

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Exact location captured.");
      },
      () => toast.error("Could not read your location."),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !vehicleType || !issueType) {
      toast.error("Select a vehicle and issue type.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("service_requests").insert({
      driver_id: user.id,
      vehicle_type: vehicleType,
      issue_type: issueType,
      exact_lat: coords?.lat ?? null,
      exact_lng: coords?.lng ?? null,
      status: "pending",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request broadcast to nearby mechanics.");
    setVehicleType("");
    setIssueType("");
  };

  const active = requests.filter((r) => r.status !== "completed").length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">{t("driverDash")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} label={t("balance")} value={`₹${profile?.wallet_balance ?? 0}`} />
        <StatCard icon={Truck} label={t("requests")} value={requests.length} />
        <StatCard icon={Wrench} label="Active" value={active} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <form onSubmit={submit} className="panel h-fit space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">{t("newRequest")}</h2>
          <div className="space-y-2">
            <Label>{t("vehicleType")}</Label>
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("issueType")}</Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger>
                <SelectValue placeholder="Select issue" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" className="w-full gap-2" onClick={locate}>
            <LocateFixed className="size-4" />
            {coords
              ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
              : "Capture exact location"}
          </Button>
          <Button type="submit" disabled={busy} className="w-full font-semibold">
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("submit")}
          </Button>
        </form>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">{t("requests")}</h2>
          {requests.length === 0 ? (
            <p className="panel p-6 text-sm text-muted-foreground">{t("noRequests")}</p>
          ) : (
            requests.map((r) => <RequestCard key={r.id} request={r} />)
          )}
        </section>
      </div>
    </main>
  );
}
