import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Activity, KeyRound, Loader2, ShieldCheck, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
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
import { RequestCard } from "@/components/RequestCard";
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
                  {p.is_verified ? (
                    <span className="text-success">{t("verified")}</span>
                  ) : (
                    <span className="text-muted-foreground">{t("unverified")}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-lg font-semibold">{t("liveFeed")}</h2>
        {requests.length === 0 ? (
          <p className="panel p-6 text-sm text-muted-foreground">{t("noRequests")}</p>
        ) : (
          requests.map((r) => <RequestCard key={r.id} request={r} />)
        )}
      </section>
    </main>
  );
}
