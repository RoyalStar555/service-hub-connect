import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { dashboardPathFor, useAuth, type Role } from "@/hooks/useAuth";

export function RoleGate({ allow, children }: { allow: Role; children: ReactNode }) {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile && profile.role !== allow) {
      navigate({ to: dashboardPathFor(profile.role), replace: true });
    }
  }, [loading, profile, allow, navigate]);

  if (loading || !profile || profile.role !== allow) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
