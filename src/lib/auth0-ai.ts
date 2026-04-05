import { Auth0AI } from "@auth0/ai-langchain";
import { MemoryStore } from "@auth0/ai/stores";
import { getFederatedAccessToken } from "./federated-tokens";

const store = new MemoryStore();

// We bypass Auth0 Token Vault (paid feature) by supplying accessToken directly.
// The withTokenVault({ accessToken }) path skips the Token Exchange grant and
// instead calls our function to retrieve the provider token from the Management API.
// Requirement: M2M client needs read:users + read:user_idp_tokens permissions.
const c = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();

const auth0AI = new Auth0AI({
  auth0: {
    domain: c(process.env.AUTH0_ISSUER_BASE_URL).replace("https://", ""),
    clientId: c(process.env.AUTH0_CLIENT_ID),
    clientSecret: c(process.env.AUTH0_CLIENT_SECRET),
  },
  store,
});

export const withGitHubAccess = auth0AI.withTokenVault({
  connection: "github",
  scopes: ["repo", "read:org", "read:user"],
  accessToken: async (_args: unknown, config: Record<string, unknown>) => {
    const configurable = config?.configurable as Record<string, unknown> | undefined;
    const userId = configurable?.user_id as string | undefined;
    const token = await getFederatedAccessToken(userId, "github");
    return token
      ? { access_token: token, id_token: "", expires_in: 86400, scope: "repo read:org read:user" }
      : undefined;
  },
});

export const withSlackAccess = auth0AI.withTokenVault({
  connection: "sign-in-with-slack",
  scopes: ["chat:write", "channels:read", "channels:manage", "users:read"],
  accessToken: async (_args: unknown, config: Record<string, unknown>) => {
    const configurable = config?.configurable as Record<string, unknown> | undefined;
    const userId = configurable?.user_id as string | undefined;
    const token = await getFederatedAccessToken(userId, "sign-in-with-slack");
    return token
      ? { access_token: token, id_token: "", expires_in: 86400, scope: "chat:write channels:read channels:manage users:read" }
      : undefined;
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
