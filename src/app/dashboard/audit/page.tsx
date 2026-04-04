"use client";

import { useState, useEffect, useCallback } from "react";
import { AuditLogTable } from "@/components/audit-log-table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TrustZone } from "@/lib/trust-policy";

interface AuditLogEntry {
  id: number;
  user_id: string;
  action: string;
  provider: string;
  trust_zone: TrustZone;
  status: string;
  details: string | null;
  created_at: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [zoneFilter, setZoneFilter] = useState<string>("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (providerFilter) params.set("provider", providerFilter);
      if (zoneFilter) params.set("trustZone", zoneFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/audit?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      }
    } finally {
      setLoading(false);
    }
  }, [providerFilter, zoneFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
        <p className="text-sm text-gray-400 mt-1">
          Complete log of all agent actions with trust zone tracking
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter audit logs by provider or trust zone</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            >
              <option value="">All Providers</option>
              <option value="github">GitHub</option>
              <option value="slack">Slack</option>
              <option value="google">Google</option>
            </select>

            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            >
              <option value="">All Trust Zones</option>
              <option value="GREEN">Green (Low Risk)</option>
              <option value="YELLOW">Yellow (Medium Risk)</option>
              <option value="RED">Red (High Risk)</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setProviderFilter("");
                setZoneFilter("");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            {logs.length} {logs.length === 1 ? "entry" : "entries"} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading audit logs...</div>
          ) : (
            <AuditLogTable logs={logs} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
