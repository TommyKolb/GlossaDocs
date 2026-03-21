import { getApiBaseUrl } from "../api/client";

/**
 * Authentication utilities for GlossaDocs
 * 
 * ⚠️ BACKEND INTEGRATION NEEDED ⚠️
 * These are placeholder functions that simulate authentication.
 * Replace these with actual backend API calls when ready.
 */

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

interface SessionUser {
  sub: string;
  username: string;
  email?: string;
}

interface AuthSessionResponse {
  user: SessionUser;
}

const USER_STORAGE_KEY = "glossadocs_user";

function toAppUser(user: SessionUser): User {
  return {
    id: user.sub,
    username: user.username,
    email: user.email,
    isGuest: false
  };
}

export async function loginWithCredentials(credentials: LoginCredentials): Promise<User> {
  const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password
    })
  });
  const data = (await response.json().catch(() => ({}))) as { user?: SessionUser; message?: string };

  if (!response.ok || !data.user) {
    throw new Error(data.message ?? "Login failed. Please try again.");
  }

  const user = toAppUser(data.user);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  return user;
}

/**
 * ============================================
 * 🔧 BACKEND TODO: Generate guest session
 * ============================================
 * 
 * This function should:
 * 1. Create a temporary guest session on the server
 * 2. Return a guest user object with limited permissions
 * 3. Optionally set a guest token for tracking
 */
export async function continueAsGuest(): Promise<User> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // PLACEHOLDER: Replace with actual API call
  const guestUser: User = {
    id: `guest_${Date.now()}`,
    username: "Guest",
    isGuest: true
  };

  // Store guest user in localStorage.
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(guestUser));

  return guestUser;
}

/**
 * ============================================
 * 🔧 BACKEND TODO: Implement logout API
 * ============================================
 * 
 * This function should:
 * 1. Invalidate the user's session on the server
 * 2. Clear authentication tokens
 * 3. Clean up any user-specific data
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include"
    });
  } catch {
    // Ignore network errors and still clear local state.
  }

  localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Get the currently logged-in user from local storage
 * In production, validate the token with the backend
 */
export function getCurrentUser(): User | null {
  try {
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    if (!userJson) return null;
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

export async function getAuthenticatedUserFromBackend(): Promise<User | null> {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.isGuest) {
    return currentUser;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/session`, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include"
    });
    const data = (await response.json().catch(() => ({}))) as Partial<AuthSessionResponse>;
    if (!response.ok || !data.user) {
      localStorage.removeItem(USER_STORAGE_KEY);
      return null;
    }

    const backendUser = toAppUser(data.user);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(backendUser));
    return backendUser;
  } catch (error) {
    console.error("Failed to bootstrap user from /auth/session:", error);
    // Prevent entering a broken authenticated state where all writes fail.
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

