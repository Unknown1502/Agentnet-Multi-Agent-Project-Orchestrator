import type { TrustZone } from "@/lib/trust-policy";
import { Badge } from "@/components/ui/badge";

interface TrustZoneBadgeProps {
  zone: TrustZone;
  className?: string;
}

const ZONE_CONFIG: Record<TrustZone, { label: string; variant: "green" | "yellow" | "red" }> = {
  GREEN: { label: "LOW RISK", variant: "green" },
  YELLOW: { label: "MEDIUM RISK", variant: "yellow" },
  RED: { label: "HIGH RISK", variant: "red" },
};

export function TrustZoneBadge({ zone, className }: TrustZoneBadgeProps) {
  const config = ZONE_CONFIG[zone];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
