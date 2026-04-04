"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TrustZoneBadge } from "@/components/trust-zone-badge";
import { Button } from "@/components/ui/button";
import type { TrustZone } from "@/lib/trust-policy";

interface PolicyEntry {
  toolName: string;
  zone: TrustZone;
  description: string;
  requiresApproval: boolean;
  provider: string;
  isCustomized: boolean;
}

export default function TrustPage() {
  const [policies, setPolicies] = useState<PolicyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch("/api/trust");
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleZoneChange = async (toolName: string, newZone: TrustZone) => {
    setSaving(toolName);
    const policy = policies.find((p) => p.toolName === toolName);
    const requiresApproval = newZone === "RED";

    try {
      const res = await fetch("/api/trust", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName, zone: newZone, requiresApproval }),
      });

      if (res.ok) {
        setPolicies((prev) =>
          prev.map((p) =>
            p.toolName === toolName
              ? { ...p, zone: newZone, requiresApproval, isCustomized: true }
              : p
          )
        );
      }
    } finally {
      setSaving(null);
    }
  };

  const groupedPolicies = policies.reduce(
    (acc, policy) => {
      const group = acc[policy.provider] || [];
      group.push(policy);
      acc[policy.provider] = group;
      return acc;
    },
    {} as Record<string, PolicyEntry[]>
  );

  const PROVIDER_LABELS: Record<string, string> = {
    github: "GitHub",
    slack: "Slack",
    google: "Google Workspace",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Trust Zone Configuration</h1>
        <p className="text-sm text-gray-400 mt-1">
          Configure risk levels for each agent action. RED zone actions require
          step-up authorization via CIBA push notification.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrustZoneBadge zone="GREEN" />
              <span className="text-sm text-gray-300">Auto-approved</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Read-only and low-impact actions execute without approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrustZoneBadge zone="YELLOW" />
              <span className="text-sm text-gray-300">Logged</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Moderate-impact actions are logged and audited
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrustZoneBadge zone="RED" />
              <span className="text-sm text-gray-300">CIBA Required</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              High-impact actions require step-up authorization via push
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading policies...</div>
      ) : (
        Object.entries(groupedPolicies).map(([provider, providerPolicies]) => (
          <Card key={provider}>
            <CardHeader>
              <CardTitle>{PROVIDER_LABELS[provider] || provider}</CardTitle>
              <CardDescription>
                {providerPolicies.length} tool{providerPolicies.length !== 1 && "s"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {providerPolicies.map((policy) => (
                  <div
                    key={policy.toolName}
                    className="flex items-center gap-4 rounded-lg border border-gray-800 p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-200">
                          {policy.toolName}
                        </span>
                        {policy.isCustomized && (
                          <span className="text-[10px] text-indigo-400 border border-indigo-700 rounded px-1">
                            CUSTOM
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {policy.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(["GREEN", "YELLOW", "RED"] as TrustZone[]).map((zone) => (
                        <Button
                          key={zone}
                          variant={policy.zone === zone ? "primary" : "ghost"}
                          size="sm"
                          onClick={() => handleZoneChange(policy.toolName, zone)}
                          disabled={saving === policy.toolName}
                          className={
                            policy.zone === zone
                              ? zone === "GREEN"
                                ? "bg-green-900/50 text-green-400 border-green-700 hover:bg-green-900/70"
                                : zone === "YELLOW"
                                  ? "bg-yellow-900/50 text-yellow-400 border-yellow-700 hover:bg-yellow-900/70"
                                  : "bg-red-900/50 text-red-400 border-red-700 hover:bg-red-900/70"
                              : ""
                          }
                        >
                          {zone}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
