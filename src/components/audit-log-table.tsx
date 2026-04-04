"use client";

import { TrustZoneBadge } from "@/components/trust-zone-badge";
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

interface AuditLogTableProps {
  logs: AuditLogEntry[];
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No audit logs found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left text-gray-400">
            <th className="pb-3 pr-4 font-medium">Time</th>
            <th className="pb-3 pr-4 font-medium">Action</th>
            <th className="pb-3 pr-4 font-medium">Provider</th>
            <th className="pb-3 pr-4 font-medium">Trust Zone</th>
            <th className="pb-3 pr-4 font-medium">Status</th>
            <th className="pb-3 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-gray-800/50">
              <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td className="py-3 pr-4 text-gray-200 font-mono text-xs">
                {log.action}
              </td>
              <td className="py-3 pr-4 text-gray-300 capitalize">
                {log.provider}
              </td>
              <td className="py-3 pr-4">
                <TrustZoneBadge zone={log.trust_zone} />
              </td>
              <td className="py-3 pr-4">
                <span
                  className={`text-xs font-medium ${
                    log.status === "success"
                      ? "text-green-400"
                      : log.status === "error"
                        ? "text-red-400"
                        : "text-yellow-400"
                  }`}
                >
                  {log.status}
                </span>
              </td>
              <td className="py-3 text-gray-400 text-xs max-w-xs truncate">
                {log.details}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
