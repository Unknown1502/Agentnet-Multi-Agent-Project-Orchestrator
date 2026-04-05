"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ConnectionCard } from "@/components/connection-card";
import { ShieldCheck, RefreshCw, Plug } from "lucide-react";

interface ConnectionInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  scopes: string[];
  icon: string;
  connected: boolean;
}

function ConnectionsContent() {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const fetchConnections = useCallback(async (bust = false) => {
    try {
      const url = bust ? "/api/connections?bust=1" : "/api/connections";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections ?? []);
        setFetchError(null);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("[Connections] API error:", res.status, err);
        setFetchError(err.error || `Server error (${res.status})`);
        setConnections([]);
      }
    } catch (e) {
      console.error("[Connections] Fetch failed:", e);
      setFetchError("Could not reach the server. Check your connection.");
      setConnections([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      setConnectError(decodeURIComponent(err));
      fetchConnections();
      return;
    }

    const justConnected = searchParams.get("connected");
    const justLinked = searchParams.get("linked");

    if (justLinked) {
      // Returned from re-login after account linking — all providers now under one sub
      fetchConnections(true);
      return;
    }

    if (justConnected) {
      // skip_put=1 means the callback already stored everything (e.g. Notion custom flow)
      const skipPut = searchParams.get("skip_put") === "1";
      if (skipPut) {
        fetchConnections(true);
        return;
      }

      // Load initial state, then call PUT to verify + mark + link the connection.
      // Pass the one-time linking token (lt) so PUT knows who the primary user was
      // before the OAuth flow replaced the session with a new sub.
      const lt = searchParams.get("lt");
      fetchConnections().then(async () => {
        try {
          const putRes = await fetch(`/api/connections/${justConnected}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lt }),
          });
          const putData = putRes.ok ? await putRes.json().catch(() => ({})) : {};

          if (putData.needsRelogin && putData.reloginUrl) {
            // Account linking succeeded — must re-login to get primary-sub session
            // Brief pause so the user sees the connections page before redirect
            setTimeout(() => {
              window.location.href = putData.reloginUrl;
            }, 800);
            return;
          }
        } catch {
          // non-fatal — UI will still show updated state after bust re-fetch
        }
        await fetchConnections(true);
      });
    } else {
      fetchConnections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConnections(true);
  };

  const handleConnect = async (provider: string) => {
    setConnectingProvider(provider);
    setConnectError(null);
    try {
      const res = await fetch(`/api/connections/${provider}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.connectUrl;
      } else {
        const err = await res.json().catch(() => ({}));
        setConnectError(err.error || `Failed to initiate connection for ${provider}`);
      }
    } catch {
      setConnectError("Failed to reach the server. Please try again.");
    } finally {
      setConnectingProvider(null);
    }
  };

  const connectedCount = connections.filter((c) => c.connected).length;

  return (
    <div className="space-y-6">
      {connectError && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-400">
          <div className="whitespace-pre-wrap">{connectError}</div>
          {connectError.includes("invalid_state") && (
            <button
              onClick={() => { setConnectError(null); window.history.replaceState({}, "", "/dashboard/connections"); }}
              className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 transition-colors"
            >
              Dismiss and try again
            </button>
          )}
        </div>
      )}

      {fetchError && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-400">
          Failed to load connections: {fetchError}
          <button onClick={handleRefresh} className="ml-3 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Plug className="h-5 w-5 text-violet-400" />
            <h1 className="text-3xl font-bold tracking-tight gradient-text">Connected Accounts</h1>
          </div>
          <p className="text-sm text-white/35">
            Services AgentNet can access on your behalf via OAuth
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-white/6 bg-white/2 px-3 py-2 text-xs text-white/35 transition-all hover:border-white/12 hover:text-white/60 disabled:opacity-30"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <div className="flex flex-col items-end gap-1.5 rounded-xl border border-white/6 bg-white/2 px-4 py-3">
            <span className="text-base font-bold tabular-nums text-white">
              {connectedCount}
              <span className="text-sm font-normal text-white/25"> / {connections.length}</span>
            </span>
            <div className="h-1 w-24 overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full bg-linear-to-r from-cyan-500 to-violet-500 transition-all duration-700"
                style={{
                  width:
                    connections.length > 0
                      ? `${(connectedCount / connections.length) * 100}%`
                      : "0%",
                }}
              />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-white/25">Connected</span>
          </div>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/6 bg-white/2 py-24">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 animate-bounce rounded-full bg-cyan-500"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="mt-4 text-sm text-white/30">Loading connections…</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onConnect={handleConnect}
              isConnecting={connectingProvider === connection.id}
            />
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="overflow-hidden rounded-2xl border border-white/6 bg-white/2">
        <div className="border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">How Connected Accounts Work</h2>
          </div>
          <p className="mt-0.5 text-xs text-white/30">
            Auth0 handles the OAuth flow — your AI retrieves tokens securely, never stored in the agent
          </p>
        </div>

        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
          {[
            {
              step: "01",
              title: "You connect",
              color: "text-cyan-400",
              bg: "bg-cyan-500/4",
              desc: "OAuth flow runs through Auth0. The provider token is stored securely in your Auth0 identity.",
            },
            {
              step: "02",
              title: "Agent requests",
              color: "text-violet-400",
              bg: "bg-violet-500/4",
              desc: "When a tool runs, the agent fetches your provider token from Auth0 using your session.",
            },
            {
              step: "03",
              title: "Token retrieved",
              color: "text-emerald-400",
              bg: "bg-emerald-500/4",
              desc: "The access token is used for the API call and discarded — never stored inside the agent.",
            },
          ].map((item) => (
            <div key={item.step} className={`px-6 py-5 ${item.bg}`}>
              <span className={`text-xs font-bold tabular-nums ${item.color}`}>{item.step}</span>
              <h3 className="mt-2 text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/35">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-sm text-white/30">
          Loading…
        </div>
      }
    >
      <ConnectionsContent />
    </Suspense>
  );
}

interface ConnectionInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  scopes: string[];
  icon: string;
  connected: boolean;
}

