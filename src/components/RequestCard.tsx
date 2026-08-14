import { MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ServiceRequest } from "@/lib/service-requests";

const statusStyles: Record<string, string> = {
  pending: "border-warning/40 bg-warning/10 text-warning",
  accepted: "border-accent/40 bg-accent/10 text-accent",
  completed: "border-success/40 bg-success/10 text-success",
};

export function RequestCard({
  request,
  children,
}: {
  request: ServiceRequest;
  children?: React.ReactNode;
}) {
  return (
    <article className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-semibold">{request.issue_type}</h3>
          <Badge
            variant="outline"
            className={`px-2 py-0 text-[10px] uppercase tracking-widest ${statusStyles[request.status] ?? ""}`}
          >
            {request.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{request.vehicle_type}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-primary" />
            {request.exact_lat != null && request.exact_lng != null
              ? `${request.exact_lat.toFixed(4)}, ${request.exact_lng.toFixed(4)}`
              : "Location pending"}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {new Date(request.created_at).toLocaleString()}
          </span>
        </div>
      </div>
      {children && <div className="flex shrink-0 gap-2">{children}</div>}
    </article>
  );
}
