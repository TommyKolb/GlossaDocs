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
const DEFAULT_DEV_OIDC_AUTH_URL =
  'http://localhost:8080/realms/glossadocs/protocol/openid-connect/auth';
const DEFAULT_DEV_OIDC_TOKEN_URL =
  'http://localhost:8080/realms/glossadocs/protocol/openid-connect/token';
const DEFAULT_DEV_OIDC_CLIENT_ID = 'glossadocs-api';

interface OidcTokenResponse {
  access_token: string;
}

function base64UrlEncode(value: Uint8Array): string {
  let raw = '';
  for (const byte of value) {
    raw += String.fromCharCode(byte);
  }
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function buildPkceParams(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const codeVerifier = base64UrlEncode(bytes);

  const hashed = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64UrlEncode(new Uint8Array(hashed));

  return { codeVerifier, codeChallenge };
}

/**
 * ============================================
 * 🔐 OIDC login (Auth Code + PKCE)
 * ============================================
 * 
 * This starts the OIDC Auth Code + PKCE flow by redirecting
 * the browser to the Keycloak authorization endpoint. The actual
 * token exchange happens in the `/auth/callback` handler.
 */
export async function loginWithCredentials(
  credentials: LoginCredentials
): Promise<User> {
  const authUrl = import.meta.env.VITE_OIDC_AUTH_URL ?? DEFAULT_DEV_OIDC_AUTH_URL;
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID ?? DEFAULT_DEV_OIDC_CLIENT_ID;
  const redirectUri =
    import.meta.env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/`;

  const { codeVerifier, codeChallenge } = await buildPkceParams();
  sessionStorage.setItem('glossadocs_pkce_code_verifier', codeVerifier);

  const url = new URL(authUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', codeChallenge);
  if (credentials.username) {
    url.searchParams.set('login_hint', credentials.username);
  }

  window.location.assign(url.toString());

  // This Promise never meaningfully resolves in normal flow because the page
  // navigates away. The return value is unused by the caller.
  throw new Error('Redirecting to identity provider');
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

export async function completeOidcLogin(code: string): Promise<User> {
  const tokenUrl = import.meta.env.VITE_OIDC_TOKEN_URL ?? DEFAULT_DEV_OIDC_TOKEN_URL;
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID ?? DEFAULT_DEV_OIDC_CLIENT_ID;
  const redirectUri =
    import.meta.env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/`;

  const codeVerifier = sessionStorage.getItem('glossadocs_pkce_code_verifier');
  if (!codeVerifier) {
    throw new Error('Login session has expired. Please start again.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<OidcTokenResponse>;
  if (!response.ok || typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new Error('Login failed. Please try again.');
  }

  sessionStorage.removeItem('glossadocs_pkce_code_verifier');
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.access_token);

  const me = await meApi.get(data.access_token);
  const user: User = {
    id: me.sub,
    username: me.username,
    email: me.email,
    isGuest: false,
  };
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  return user;
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

