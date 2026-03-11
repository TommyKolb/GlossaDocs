import { meApi } from '../api/endpoints';

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

const USER_STORAGE_KEY = 'glossadocs_user';
const ACCESS_TOKEN_STORAGE_KEY = 'authToken';
const DEFAULT_DEV_OIDC_TOKEN_URL =
  'http://localhost:8080/realms/glossadocs/protocol/openid-connect/token';
const DEFAULT_DEV_OIDC_CLIENT_ID = 'glossadocs-api';

interface OidcTokenResponse {
  access_token: string;
}

function looksLikeJwt(value: string): boolean {
  return value.split('.').length === 3;
}

async function tryExchangeDevCredentialsForToken(
  credentials: LoginCredentials
): Promise<string | null> {
  const tokenUrl = import.meta.env.VITE_OIDC_TOKEN_URL ?? DEFAULT_DEV_OIDC_TOKEN_URL;
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID ?? DEFAULT_DEV_OIDC_CLIENT_ID;

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    username: credentials.username,
    password: credentials.password,
    scope: 'openid profile email',
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Partial<OidcTokenResponse>;
    if (typeof data.access_token === 'string' && data.access_token.length > 0) {
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * ============================================
 * 🔧 BACKEND TODO: Implement actual login API
 * ============================================
 * 
 * This function should:
 * 1. Send credentials to your authentication server
 * 2. Validate username and password
 * 3. Return user data and auth token on success
 * 4. Handle errors (invalid credentials, server errors, etc.)
 * 
 * Example implementation:
 * ```
 * const response = await fetch('https://your-api.com/auth/login', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify(credentials)
 * });
 * const data = await response.json();
 * if (!response.ok) throw new Error(data.message);
 * localStorage.setItem('authToken', data.token);
 * return data.user;
 * ```
 */
export async function loginWithCredentials(
  credentials: LoginCredentials
): Promise<User> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  // PLACEHOLDER: Replace with actual API call
  if (credentials.username && credentials.password) {
    // Prefer real JWT token acquisition for local Docker Keycloak dev.
    // If unavailable, fall back to the password-as-token placeholder.
    const exchangedToken = await tryExchangeDevCredentialsForToken(credentials);
    const placeholderToken = credentials.password.trim();
    if (!exchangedToken && !looksLikeJwt(placeholderToken)) {
      throw new Error(
        'Unable to obtain a valid auth token. Use devuser/devpass in Docker mode, paste a JWT as password, or continue as guest.'
      );
    }

    const devAccessToken = exchangedToken ?? placeholderToken;
    if (devAccessToken) {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, devAccessToken);
    }

    try {
      const me = await meApi.get(devAccessToken);
      const user: User = {
        id: me.sub,
        username: me.username,
        email: me.email,
        isGuest: false,
      };
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      return user;
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      throw new Error(
        'Authenticated session bootstrap failed. Verify backend/Keycloak are running, or continue as guest.'
      );
    }
  }

  throw new Error('Invalid credentials');
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
    username: 'Guest',
    isGuest: true,
  };

  // Store guest user in localStorage and clear any authenticated token.
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(guestUser));
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);

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
  // TODO(OIDC): Invalidate remote IdP session and revoke/clear tokens.
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
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

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export async function getAuthenticatedUserFromBackend(): Promise<User | null> {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.isGuest) {
    return currentUser;
  }

  const token = getAccessToken();
  if (!token) {
    return currentUser;
  }

  try {
    const me = await meApi.get(token);
    const backendUser: User = {
      id: me.sub,
      username: me.username,
      email: me.email,
      isGuest: false,
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(backendUser));
    return backendUser;
  } catch (error) {
    // TODO(OIDC): On real auth integration, handle token refresh/reauth here.
    console.error('Failed to bootstrap user from /me:', error);
    // Prevent entering a broken authenticated state where all writes fail.
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    return null;
  }
}

