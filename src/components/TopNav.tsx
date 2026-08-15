import { Link, useNavigate } from "@tanstack/react-router";
import { Globe, LogOut, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LANGUAGES, useLanguage } from "@/contexts/LanguageContext";
import { dashboardPathFor, useAuth } from "@/hooks/useAuth";

export function TopNav() {
  const { t, language, setLanguage } = useLanguage();
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="hazard-stripe h-0.5 w-full opacity-70" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to={dashboardPathFor(profile?.role)}
          className="flex items-center transition-opacity hover:opacity-80"
        >
          <Logo className="h-11" />
          <span className="sr-only">{t("appName")}</span>
        </Link>


        <div className="flex items-center gap-2 sm:gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Globe className="size-4" />
                <span className="font-semibold">
                  {LANGUAGES.find((l) => l.code === language)?.label}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {LANGUAGES.map((l) => (
                <DropdownMenuItem
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className="flex items-center justify-between"
                >
                  <span>{l.native}</span>
                  <span className="text-xs text-muted-foreground">{l.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight">
              {profile?.full_name || user?.email?.split("@")[0] || "—"}
            </p>
            <div className="flex items-center justify-end gap-1.5">
              <Badge
                variant="outline"
                className="border-primary/40 px-1.5 py-0 text-[10px] uppercase tracking-widest text-primary"
              >
                {profile?.role ? t(profile.role) : "—"}
              </Badge>
              {profile?.is_verified && <ShieldCheck className="size-3.5 text-success" />}
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">{t("logout")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
