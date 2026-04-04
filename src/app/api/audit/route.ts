import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAuditLogs } from "@/lib/db";
import type { TrustZone } from "@/lib/trust-policy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user?.sub as string;
  const searchParams = request.nextUrl.searchParams;

  const provider = searchParams.get("provider") || undefined;
  const trustZone = (searchParams.get("trustZone") as TrustZone) || undefined;
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const logs = await getAuditLogs(userId, { provider, trustZone, limit, offset });

  return NextResponse.json({ logs, total: logs.length });
}
