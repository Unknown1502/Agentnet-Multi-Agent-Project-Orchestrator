import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getUserTrustPolicies, upsertTrustPolicy } from "@/lib/db";
import { DEFAULT_TRUST_POLICIES, type TrustZone } from "@/lib/trust-policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user?.sub as string;
  const userPolicies = await getUserTrustPolicies(userId);

  const merged = DEFAULT_TRUST_POLICIES.map((defaultPolicy) => {
    const userOverride = userPolicies.find(
      (p) => p.tool_name === defaultPolicy.toolName
    );
    if (userOverride) {
      return {
        ...defaultPolicy,
        zone: userOverride.zone,
        requiresApproval: userOverride.requires_approval === 1,
        isCustomized: true,
      };
    }
    return { ...defaultPolicy, isCustomized: false };
  });

  return NextResponse.json({ policies: merged });
}

export async function PUT(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user?.sub as string;

  let body: { toolName: string; zone: TrustZone; requiresApproval: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { toolName, zone, requiresApproval } = body;

  if (!toolName || !zone) {
    return NextResponse.json(
      { error: "toolName and zone are required" },
      { status: 400 }
    );
  }

  const validZones: TrustZone[] = ["GREEN", "YELLOW", "RED"];
  if (!validZones.includes(zone)) {
    return NextResponse.json(
      { error: "Invalid trust zone" },
      { status: 400 }
    );
  }

  await upsertTrustPolicy(userId, toolName, zone, requiresApproval);

  return NextResponse.json({ success: true });
}
