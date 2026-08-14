import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { dashboardPathFor, useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Service Hub — Commercial Vehicle Roadside Assistance" },
      {
        name: "description",
        content:
          "Service Hub connects commercial fleet drivers with verified roadside mechanics for fast breakdown recovery, with live dispatch and wallet-based job unlocks.",
      },
      { property: "og:title", content: "Service Hub — Commercial Vehicle Roadside Assistance" },
      {
        property: "og:description",
        content: "B2B roadside assistance dispatch for commercial vehicle fleets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { loading, user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && profile) navigate({ to: dashboardPathFor(profile.role), replace: true });
    else if (!user) navigate({ to: "/auth", replace: true });
  }, [loading, user, profile, navigate]);

  return (
    <div className="grid-industrial flex min-h-screen items-center justify-center">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}
