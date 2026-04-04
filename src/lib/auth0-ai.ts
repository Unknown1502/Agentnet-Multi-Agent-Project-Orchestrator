import { Auth0AI } from "@auth0/ai-langchain";
import { MemoryStore } from "@auth0/ai/stores";

const store = new MemoryStore();

// IMPORTANT: client_id in the Token Vault exchange MUST match the client that
// issued the user's refresh token. Since the user logs in via the Regular Web App,
// we use AUTH0_CLIENT_ID / AUTH0_CLIENT_SECRET here — NOT the separate M2M app.
// The Token Vault grant type must be enabled on this application in Auth0 Dashboard:
// Applications → AgentNet → Advanced Settings → Grant Types → Token Exchange.
const auth0AI = new Auth0AI({
  auth0: {
    domain: process.env.AUTH0_ISSUER_BASE_URL?.replace("https://", "") || "",
    clientId: process.env.AUTH0_CLIENT_ID || "",
    clientSecret: process.env.AUTH0_CLIENT_SECRET || "",
  },
  store,
});

export const withGitHubAccess = auth0AI.withTokenVault({
  connection: "github",
  scopes: ["repo", "read:org", "read:user"],
  refreshToken: async (_args: unknown, config: Record<string, unknown>) => {
    const configurable = config?.configurable as Record<string, unknown> | undefined;
    return configurable?.refresh_token as string | undefined;
  },
});

export const withSlackAccess = auth0AI.withTokenVault({
  connection: "sign-in-with-slack",
  scopes: ["chat:write", "channels:read", "channels:manage", "users:read"],
  refreshToken: async (_args: unknown, config: Record<string, unknown>) => {
    const configurable = config?.configurable as Record<string, unknown> | undefined;
    return configurable?.refresh_token as string | undefined;
  },
});

export const withNotionAccess = auth0AI.withTokenVault({
  connection: "notion",
  scopes: [],
  refreshToken: async (_args: unknown, config: Record<string, unknown>) => {
    const configurable = config?.configurable as Record<string, unknown> | undefined;
    return configurable?.refresh_token as string | undefined;
  },
});

export const withStepUpAuth = auth0AI.withAsyncAuthorization({
  scopes: ["openid"],
  userID: async (_args: unknown, config: Record<string, unknown>): Promise<string> => {
    const configurable = config?.configurable as Record<string, unknown> | undefined;
    return (configurable?.user_id as string) || "";
  },
  bindingMessage: async (args: unknown): Promise<string> => {
    const params = args as Record<string, unknown>;
    return `AgentNet: Approve "${params?.action_description || "high-risk action"}"?`;
  },
  requestedExpiry: 300,
});

export { auth0AI };
