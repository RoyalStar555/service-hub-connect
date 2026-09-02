import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Activity, BadgeIndianRupee, Image as ImageIcon, KeyRound, Loader2, ShieldCheck, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleGate } from "@/components/RoleGate";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/StatCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { updateMasterKey } from "@/lib/master-key.functions";
import type { Profile } from "@/hooks/useAuth";
import type { ServiceRequest } from "@/lib/service-requests";


export const Route = createFileRoute("/_authenticated/admin-dash")({
  head: () => ({
    meta: [
      { title: "Admin Console — Service Hub" },
      {
        name: "description",
        content:
          "Monitor drivers, mechanics, wallet balances and live roadside assistance jobs across the Service Hub network.",
      },
      { property: "og:title", content: "Admin Console — Service Hub" },
      {
        property: "og:description",
        content: "Network-wide oversight of users, wallets and live roadside jobs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RoleGate allow="admin">
      <AdminDash />
    </RoleGate>
  ),
});

function AdminDash() {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [unlockFee, setUnlockFee] = useState(50);

  useEffect(() => {
    const load = async () => {
      const [p, r, s] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("service_requests").select("*").order("created_at", { ascending: false }),
        supabase
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", "unlock_fee")
          .maybeSingle(),
      ]);
      setProfiles((p.data as Profile[]) ?? []);
      setRequests((r.data as ServiceRequest[]) ?? []);
      if (s.data) setUnlockFee(Number(s.data.setting_value));
    };
    void load();

    const channel = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, () =>
        load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const revenue = requests.reduce((sum, r) => sum + Number(r.fee_paid ?? 0), 0);
  const treasury = requests
    .filter((r) => r.status === "accepted")
    .reduce((sum, r) => sum + Number(r.fee_paid ?? 0), 0);

  const vehicleData = useMemo(() => {
    const counts = new Map<string, number>();
    requests.forEach((request) => {
      const model = request.vehicle_model?.trim() || request.vehicle_type;
      counts.set(model, (counts.get(model) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [requests]);

  const revenueData = useMemo(() => {
    const byDate = new Map<string, number>();
    requests
      .filter((request) => request.status === "accepted")
      .forEach((request) => {
        const date = new Date(request.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        byDate.set(date, (byDate.get(date) ?? 0) + Number(request.fee_paid ?? 0));
      });
    return [...byDate.entries()].map(([date, revenue]) => ({ date, revenue })).slice(-7);
  }, [requests]);

  const telemetryInsight = useMemo(() => {
    if (requests.length === 0) return "⚠️ No breakdown patterns are available yet.";
    const model = vehicleData[0]?.name ?? "vehicle";
    const locations = new Map<string, number>();
    requests.forEach((request) => {
      const location = request.breakdown_address?.split(",")[0]?.trim() || "the reported service area";
      locations.set(location, (locations.get(location) ?? 0) + 1);
    });
    const location = [...locations.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "the reported service area";
    return `⚠️ High volume of ${model} breakdowns near ${location}. Recommend premium mechanics stock parts.`;
  }, [requests, vehicleData]);

  const chartColors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

  const [media, setMedia] = useState<ServiceRequest | null>(null);
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);

  const openMedia = async (request: ServiceRequest) => {
    setMedia(request);
    setMediaSrc(null);
    const url = request.media_url;
    if (!url) return;
    const match = url.match(/\/media\/(.+)$/);
    if (match) {
      const { data } = await supabase.storage.from("media").createSignedUrl(match[1] ?? "", 3600);
      setMediaSrc(data?.signedUrl ?? url);
    } else {
      setMediaSrc(url);
    }
  };


  const togglePremium = async (p: Profile) => {
    const next = !p.is_premium_badge;
    const { error } = await supabase
      .from("profiles")
      .update({ is_premium_badge: next })
      .eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setProfiles((prev) =>
      prev.map((row) => (row.id === p.id ? { ...row, is_premium_badge: next } : row)),
    );
    toast.success("Premium Status Updated");
  };

  const rotateKey = useServerFn(updateMasterKey);
  const [currentKey, setCurrentKey] = useState("");
  const [newKey, setNewKey] = useState("");
  const [confirmKey, setConfirmKey] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);

  const handleKeyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newKey !== confirmKey) {
      toast.error("New keys do not match");
      return;
    }
    setKeyBusy(true);
    try {
      const res = await rotateKey({ data: { currentKey, newKey } });
      if (res.ok) {
        toast.success(res.message);
        setCurrentKey("");
        setNewKey("");
        setConfirmKey("");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Could not update the master key");
    } finally {
      setKeyBusy(false);
    }
  };


  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">{t("adminDash")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("platform")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label={t("users")} value={profiles.length} />
        <StatCard icon={Activity} label={t("requests")} value={requests.length} />
        <StatCard icon={Wallet} label="Unlock revenue" value={`₹${revenue}`} />
        <StatCard icon={ShieldCheck} label={t("unlockFee")} value={`₹${unlockFee}`} />
        <StatCard
          icon={BadgeIndianRupee}
          label="Platform Treasury"
          value={`₹${treasury}`}
          hint="Total Revenue Collected"
        />
      </div>


      <section className="panel mt-8 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">Security Settings</h2>
            <p className="text-sm text-muted-foreground">
              Rotate the admin master key required to create new admin accounts.
            </p>
          </div>
        </div>

        <form onSubmit={handleKeyUpdate} className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="current-key">Current Key</Label>
            <Input
              id="current-key"
              type="password"
              required
              value={currentKey}
              onChange={(e) => setCurrentKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-key">New Key</Label>
            <Input
              id="new-key"
              type="password"
              required
              minLength={6}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-key">Confirm New Key</Label>
            <Input
              id="confirm-key"
              type="password"
              required
              minLength={6}
              value={confirmKey}
              onChange={(e) => setConfirmKey(e.target.value)}
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={keyBusy} className="font-semibold">
              {keyBusy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Update Key
            </Button>
          </div>
        </form>
      </section>



      <section className="panel mt-8 overflow-x-auto">
        <h2 className="border-b border-border px-6 py-4 font-display text-lg font-semibold">
          {t("users")}
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fullName")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead className="text-right">{t("balance")}</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-right">Premium Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                    {p.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.phone ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">₹{p.wallet_balance}</TableCell>
                <TableCell className="text-right text-xs">
                   {p.role === "mechanic" && p.is_premium_badge ? (
                     <span className="font-bold text-success">Premium Verified</span>
                   ) : p.is_verified ? (
                    <span className="text-success">{t("verified")}</span>
                  ) : (
                    <span className="text-muted-foreground">{t("unverified")}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {p.role === "mechanic" ? (
                    <div className="flex items-center justify-end gap-2">
                      <Switch
                        checked={p.is_premium_badge}
                        onCheckedChange={() => void togglePremium(p)}
                        aria-label={`Toggle premium status for ${p.full_name ?? "mechanic"}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {p.is_premium_badge ? "Premium" : "Standard"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="panel mt-10 rounded-2xl p-6 shadow-md sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Platform Telemetry</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live breakdown mix and unlock revenue signals.</p>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary">Real-time</Badge>
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-base font-semibold">Breakdowns by Vehicle Model</h3>
            {vehicleData.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No vehicle data yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={vehicleData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={3}>
                      {vehicleData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              {vehicleData.map((entry, index) => (
                <span key={entry.name} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                  {entry.name} ({entry.value})
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">Revenue Collected</h3>
            {revenueData.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No accepted jobs yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm font-medium text-foreground">
          {telemetryInsight}
        </div>
      </section>

      <section className="panel mt-10 overflow-x-auto">
        <h2 className="border-b border-border px-6 py-4 font-display text-lg font-semibold">
          {t("liveFeed")}
        </h2>
        {requests.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("noRequests")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Breakdown Address</TableHead>
                <TableHead>Vehicle Model</TableHead>
                <TableHead className="text-right">Fee Collected</TableHead>
                <TableHead className="text-right">Media</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">
                    {r.breakdown_address ?? "—"}
                  </TableCell>
                  <TableCell>{r.vehicle_model ?? r.vehicle_type}</TableCell>
                  <TableCell className="text-right tabular-nums">₹{r.fee_paid}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void openMedia(r)}
                      disabled={!r.media_url && !r.customer_note}
                    >
                      <ImageIcon className="mr-1.5 size-3.5" /> View Media
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <Dialog open={!!media} onOpenChange={(open) => !open && setMedia(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {media?.vehicle_model ?? media?.vehicle_type} · {media?.issue_type}
            </DialogTitle>
            <DialogDescription>{media?.breakdown_address ?? "No address recorded"}</DialogDescription>
          </DialogHeader>
          {media?.media_url ? (
            mediaSrc ? (
              <img
                src={mediaSrc}
                alt={`Breakdown photo for ${media.issue_type}`}
                className="w-full rounded-2xl border border-border object-cover"
              />
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" /> Loading image…
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">No photo uploaded.</p>
          )}
          <p className="text-sm text-foreground">
            {media?.customer_note ? media.customer_note : "No customer note."}
          </p>
        </DialogContent>
      </Dialog>

    </main>
  );
}
