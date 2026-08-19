import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Star, Truck, Wallet, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleGate } from "@/components/RoleGate";
import { RequestCard } from "@/components/RequestCard";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ServiceRequest } from "@/lib/service-requests";

const DriverMap = lazy(() => import("@/components/DriverMap"));

const VEHICLES = ["16-Tyre Truck", "24-Tyre Trailer"];

const ISSUES = [
  { emoji: "🛞", label: "Tyre" },
  { emoji: "⚙️", label: "Engine" },
  { emoji: "🔋", label: "Battery" },
  { emoji: "🛑", label: "Brakes" },
];

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

type Phase = "form" | "searching" | "dispatched";

function DriverDash() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [vehicleType, setVehicleType] = useState("");
  const [issueType, setIssueType] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [activeId, setActiveId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [rateTarget, setRateTarget] = useState<ServiceRequest | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (!navigator.geolocation) {
      toast.error("Location access is required for SOS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error("Location access is required for SOS."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    setAddressLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`,
          { headers: { Accept: "application/json" } },
        );
        const json = (await res.json()) as { display_name?: string };
        if (!cancelled && json.display_name) setAddress(json.display_name);
      } catch {
        if (!cancelled) setAddress(null);
      } finally {
        if (!cancelled) setAddressLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coords]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("service_requests")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false });
      const rows = (data as ServiceRequest[]) ?? [];
      setRequests(rows);
      setRateTarget((current) => {
        if (current) return current;
        return (
          rows.find(
            (r) => r.status === "completed" && r.rating == null && !dismissed.includes(r.id),
          ) ?? null
        );
      });
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
  }, [user, dismissed]);

  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`sos-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "service_requests",
          filter: `id=eq.${activeId}`,
        },
        (payload) => {
          const status = (payload.new as { status?: string }).status;
          if (status === "accepted") setPhase("dispatched");
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId]);

  const broadcast = async () => {
    if (!user || !vehicleType || !issueType) {
      toast.error("Select a vehicle and issue type.");
      return;
    }
    setBusy(true);
    try {
      let mediaUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("media")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        mediaUrl = signed?.signedUrl ?? path;
      }

      const { data, error } = await supabase
        .from("service_requests")
        .insert({
          driver_id: user.id,
          vehicle_type: vehicleType,
          issue_type: issueType,
          vehicle_model: vehicleModel || null,
          customer_note: customerNote || null,
          breakdown_address: address,
          media_url: mediaUrl,
          exact_lat: coords?.lat ?? null,
          exact_lng: coords?.lng ?? null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      setActiveId(data.id);
      setPhase("searching");
      toast.success("SOS broadcast to nearby mechanics.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not broadcast SOS.");
    } finally {
      setBusy(false);
    }
  };

  const submitRating = async () => {
    if (!rateTarget || rating < 1) {
      toast.error("Please select a star rating.");
      return;
    }
    setRateBusy(true);
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ rating, feedback: feedback || null })
        .eq("id", rateTarget.id);
      if (error) throw error;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === rateTarget.id ? { ...r, rating, feedback: feedback || null } : r,
        ),
      );
      closeRating();
      toast.success("Thanks! Your rating has been submitted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit your rating.");
    } finally {
      setRateBusy(false);
    }
  };

  const closeRating = () => {
    if (rateTarget) setDismissed((prev) => [...prev, rateTarget.id]);
    setRateTarget(null);
    setRating(0);
    setHoverRating(0);
    setFeedback("");
  };

  const reset = () => {
    setPhase("form");
    setActiveId(null);
    setVehicleType("");
    setIssueType("");
    setVehicleModel("");
    setCustomerNote("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const active = requests.filter((r) => r.status !== "completed").length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-foreground">{t("driverDash")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} label={t("balance")} value={`₹${profile?.wallet_balance ?? 0}`} />
        <StatCard icon={Truck} label={t("requests")} value={requests.length} />
        <StatCard icon={Wrench} label="Active" value={active} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        <div className="h-fit rounded-2xl border border-border bg-card p-6 shadow-md">
          {phase === "form" && (
            <div className="space-y-5">
              <h2 className="font-display text-xl font-semibold">{t("newRequest")}</h2>

              <div className="space-y-2">
                <Label>{t("vehicleType")}</Label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("issueType")}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {ISSUES.map((i) => {
                    const selected = issueType === i.label;
                    return (
                      <button
                        key={i.label}
                        type="button"
                        onClick={() => setIssueType(i.label)}
                        className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border text-sm font-medium transition ${
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="text-3xl">{i.emoji}</span>
                        {i.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle-model">Vehicle Model</Label>
                <Input
                  id="vehicle-model"
                  className="rounded-xl"
                  placeholder="e.g. Tata Signa 4825.TK"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-note">Describe the Problem</Label>
                <Textarea
                  id="customer-note"
                  className="min-h-24 rounded-xl"
                  placeholder="Tell the mechanic what happened..."
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="media">Photo of the issue (optional)</Label>
                <Input
                  id="media"
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="rounded-xl"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {addressLoading
                      ? "Finding your address..."
                      : (address ?? "Waiting for GPS location...")}
                  </p>
                </div>
              </div>

              <Button
                onClick={broadcast}
                disabled={busy}
                className="h-12 w-full rounded-xl text-base font-semibold tracking-wide"
              >
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                BROADCAST SOS
              </Button>
            </div>
          )}

          {phase === "searching" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <Loader2 className="size-10 animate-spin text-primary" />
              <p className="font-display text-lg font-semibold">
                Searching for nearby mechanics...
              </p>
              <p className="text-sm text-muted-foreground">
                {vehicleType} · {issueType}
              </p>
              <Button variant="outline" className="rounded-xl" onClick={reset}>
                Back
              </Button>
            </div>
          )}

          {phase === "dispatched" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle2 className="size-12 text-primary" />
              <p className="font-display text-xl font-semibold">Mechanic Dispatched!</p>
              <p className="text-sm text-muted-foreground">
                Help is on the way to your location.
              </p>
              <Button className="rounded-xl" onClick={reset}>
                New request
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
            <div className="flex items-start gap-2 px-6 py-4">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <span className="block text-sm font-medium">
                  {coords
                    ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                    : "Waiting for GPS..."}
                </span>
                {(address || addressLoading) && (
                  <span className="block text-xs text-muted-foreground">
                    {addressLoading ? "Finding your address..." : address}
                  </span>
                )}
              </div>
            </div>

            <div className="h-80 w-full overflow-hidden rounded-2xl">
              {coords ? (
                <ClientOnly
                  fallback={<div className="h-full w-full animate-pulse bg-muted" />}
                >
                  <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
                    <DriverMap lat={coords.lat} lng={coords.lng} />
                  </Suspense>
                </ClientOnly>
              ) : (
                <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                  Location access is required for SOS.
                </div>
              )}
            </div>
          </div>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">{t("requests")}</h2>
            {requests.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-md">
                {t("noRequests")}
              </p>
            ) : (
              requests.map((r) => <RequestCard key={r.id} request={r} />)
            )}
          </section>
        </div>
      </div>

      <Dialog open={!!rateTarget} onOpenChange={(open) => !open && !rateBusy && closeRating()}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Rate Your Mechanic</DialogTitle>
            <DialogDescription>
              {rateTarget?.vehicle_model ?? rateTarget?.vehicle_type} · {rateTarget?.issue_type}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= (hoverRating || rating);
              return (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`size-9 ${
                      filled ? "fill-primary text-primary" : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback (optional)</Label>
            <Textarea
              id="feedback"
              className="min-h-24 rounded-xl"
              placeholder="How was the service?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={closeRating} disabled={rateBusy}>
              Later
            </Button>
            <Button className="rounded-xl font-semibold" onClick={submitRating} disabled={rateBusy}>
              {rateBusy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Submit Rating
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
