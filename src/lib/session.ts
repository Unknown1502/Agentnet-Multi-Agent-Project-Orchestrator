import { auth0 } from "./auth0";

export async function getSession() {
  return auth0.getSession();
}

export async function getAccessToken() {
  return auth0.getAccessToken();
}

export async function getAccessTokenForConnection(connection: string) {
  return auth0.getAccessTokenForConnection({ connection });
}
