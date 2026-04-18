import { z } from "zod";

import { ApiClientError } from "../api/client";
import { authApi, type AuthSessionUser } from "../api/endpoints";
import { resetRemoteDocumentCache } from "../data/remote-document-cache";

export interface User {
  id: string;
  username: string;
  email?: string;
  isGuest: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

const USER_STORAGE_KEY = "glossadocs_user";
const isDevBuild =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const storedUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  email: z.string().optional(),
  isGuest: z.boolean()
});

/**
 * React session (App state) can briefly disagree with `localStorage` (e.g. child effects vs parent,
 * or multi-tab storage events). Document and settings code must use `getEffectiveUser()` so the UI
 * session is the source of truth once the shell has hydrated.
 */
let sessionReactOverride: User | null | undefined;

export function setSessionOverride(next: User | null | undefined): void {
  sessionReactOverride = next;
}

function toAppUser(user: AuthSessionUser): User {
  return {
    id: user.sub,
    username: user.username,
    email: user.email,
    isGuest: false
  };
}

function clearClientAuthState(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
  resetRemoteDocumentCache();
  setSessionOverride(null);
}

function markSessionUnknownState(): void {
  resetRemoteDocumentCache();
  setSessionOverride(null);
}

export async function loginWithCredentials(credentials: LoginCredentials): Promise<User> {
  const data = await authApi.login({
    username: credentials.username,
    password: credentials.password
  });

  resetRemoteDocumentCache();
  const user = toAppUser(data.user);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  setSessionOverride(user);
  return user;
}

/**
 * Guest mode remains local-only by design so users can run the app without backend services.
 */
export async function continueAsGuest(): Promise<User> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const guestUser: User = {
    id: `guest_${Date.now()}`,
    username: "Guest",
    isGuest: true
  };

  resetRemoteDocumentCache();
  // Store guest user in localStorage.
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(guestUser));
  setSessionOverride(guestUser);

  return guestUser;
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    // Ignore network errors and still clear local state.
  }

  clearClientAuthState();
}

export function getCurrentUser(): User | null {
  try {
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    if (!userJson) return null;
    const parsed = JSON.parse(userJson);
    const result = storedUserSchema.safeParse(parsed);
    if (!result.success) {
      clearClientAuthState();
      return null;
    }
    return result.data;
  } catch {
    clearClientAuthState();
    return null;
  }
}

export function getEffectiveUser(): User | null {
  if (sessionReactOverride !== undefined) {
    return sessionReactOverride;
  }
  return getCurrentUser();
}

/** Max time to wait for `/auth/session` during startup so the UI never hangs on "Loading…" if the API is down. */
const SESSION_BOOTSTRAP_TIMEOUT_MS = 12_000;

function createSessionBootstrapSignal(): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(SESSION_BOOTSTRAP_TIMEOUT_MS);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), SESSION_BOOTSTRAP_TIMEOUT_MS);
  return controller.signal;
}

export async function getAuthenticatedUserFromBackend(): Promise<User | null> {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    setSessionOverride(null);
    return null;
  }
  if (currentUser.isGuest) {
    setSessionOverride(currentUser);
    return currentUser;
  }

  try {
    const data = await authApi.session({ signal: createSessionBootstrapSignal() });
    if (!data.user) {
      clearClientAuthState();
      return null;
    }
    const backendUser = toAppUser(data.user);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(backendUser));
    setSessionOverride(backendUser);
    return backendUser;
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 401) {
        clearClientAuthState();
        return null;
      }
      if (isDevBuild) {
        console.error("Session bootstrap failed with API error; requiring re-authentication:", error);
      }
      markSessionUnknownState();
      return null;
    }
    if (isDevBuild) {
      console.error("Failed to bootstrap user from /auth/session; requiring re-authentication:", error);
    }
    markSessionUnknownState();
    return null;
  }
}

