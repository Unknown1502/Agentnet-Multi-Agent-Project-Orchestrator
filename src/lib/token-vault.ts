import { auth0 } from "./auth0";

export async function getRefreshTokenFromSession(): Promise<string | undefined> {
  const session = await auth0.getSession();
  if (!session) return undefined;
  // In @auth0/nextjs-auth0 v4, refreshToken is at session.tokenSet.refreshToken
  const s = session as { tokenSet?: { refreshToken?: string } } & Record<string, unknown>;
  return s.tokenSet?.refreshToken;
}

export async function getUserIdFromSession(): Promise<string | undefined> {
  const session = await auth0.getSession();
  if (!session) return undefined;
  return session.user?.sub as string | undefined;
}
