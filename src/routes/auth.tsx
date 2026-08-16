import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Truck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dashboardPathFor, useAuth, type Role } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Service Hub Roadside Assistance" },
      {
        name: "description",
        content:
          "Access Service Hub, the B2B roadside assistance network for commercial vehicle fleets, mechanics and dispatch admins.",
      },
      { property: "og:title", content: "Sign in — Service Hub Roadside Assistance" },
      {
        property: "og:description",
        content: "Drivers, mechanics and admins sign in to the Service Hub dispatch network.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [masterKey, setMasterKey] = useState("");


  useEffect(() => {
    if (!loading && user && profile) {
      navigate({ to: dashboardPathFor(profile.role), replace: true });
    }
  }, [loading, user, profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      toast.error(t("selectRole"));
      return;
    }
    setBusy(true);
    if (role === "admin") {
      const { valid } = await verifyKey({ data: { key: masterKey } });
      if (!valid) {
        setBusy(false);
        toast.error("Access Denied: Invalid Master Key");
        return;
      }
    }
    const { data, error } = await supabase.auth.signUp({

      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone, role },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Check your email to confirm your account.");
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Try email instead.");
    }
  };

  return (
    <main className="grid-industrial relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[38rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <div className="relative grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
        <section className="hidden lg:block">
          <Logo className="h-20" />
          <h1 className="mt-8 font-display text-5xl font-semibold leading-[1.05]">
            Roadside help,
            <span className="mt-2 block text-2xl font-normal text-muted-foreground">
              {t("tagline")}
            </span>
          </h1>

          <ul className="mt-10 space-y-4 text-sm text-muted-foreground">
            {[
              { icon: Truck, text: "Dispatch breakdown jobs with exact GPS in seconds." },
              { icon: Wrench, text: "Verified mechanics unlock jobs from a live feed." },
              { icon: ShieldCheck, text: "Wallet-based unlock fees, fully auditable by admins." },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="pt-1.5 leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-7 sm:p-10">
          <Logo className="mx-auto mb-6 h-14 lg:hidden" />
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 bg-secondary">

              <TabsTrigger value="login">{t("login")}</TabsTrigger>
              <TabsTrigger value="signup">{t("signup")}</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t("email")}</Label>
                  <Input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="fleet@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{t("password")}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={busy} className="w-full font-semibold">
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {t("login")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("fullName")}</Label>
                    <Input
                      id="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("phone")}</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t("email")}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t("password")}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">{t("role")}</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder={t("selectRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="driver">{t("driver")}</SelectItem>
                      <SelectItem value="mechanic">{t("mechanic")}</SelectItem>
                      <SelectItem value="admin">{t("admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={busy} className="w-full font-semibold">
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {t("signup")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={handleGoogle}
          >
            Continue with Google
          </Button>
        </section>
      </div>
    </main>
  );
}
