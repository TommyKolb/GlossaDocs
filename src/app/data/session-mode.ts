import { getEffectiveUser } from "../utils/auth";

export function isAuthenticatedMode(): boolean {
  const user = getEffectiveUser();
  return Boolean(user && !user.isGuest);
}
