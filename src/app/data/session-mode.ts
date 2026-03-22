import { getCurrentUser } from "../utils/auth";

export function isAuthenticatedMode(): boolean {
  const user = getCurrentUser();
  return Boolean(user && !user.isGuest);
}
