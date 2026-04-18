import { getEffectiveUser } from '../utils/auth';

/** Central place for deciding whether data repositories should use authenticated remote APIs. */
export function isAuthenticatedMode(): boolean {
  const user = getEffectiveUser();
  return Boolean(user && !user.isGuest);
}
