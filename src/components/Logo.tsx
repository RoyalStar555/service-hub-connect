import logoAsset from "@/assets/service-hub-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Service Hub logo"
      className={cn("h-10 w-auto object-contain mix-blend-multiply", className)}
    />
  );
}
