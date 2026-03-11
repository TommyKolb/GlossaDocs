import { getAccessToken, getCurrentUser } from "../utils/auth";

export function isAuthenticatedMode(): boolean {
  const user = getCurrentUser();
  return Boolean(user && !user.isGuest);
}

export function requireAccessToken(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error(
      "Authenticated mode requires an access token. TODO(OIDC): replace mock login with real token acquisition."
    );
  }
  return token;
}
