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
    // Simulate successful login
    const user: User = {
      id: `user_${Date.now()}`,
      username: credentials.username,
      email: `${credentials.username}@example.com`,
      isGuest: false,
    };
    
    // Store user in localStorage (replace with proper token storage)
    localStorage.setItem('glossadocs_user', JSON.stringify(user));
    
    return user;
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

  // Store guest user in localStorage
  localStorage.setItem('glossadocs_user', JSON.stringify(guestUser));

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
  // PLACEHOLDER: Replace with actual API call
  localStorage.removeItem('glossadocs_user');
  localStorage.removeItem('authToken');
}

/**
 * Get the currently logged-in user from local storage
 * In production, validate the token with the backend
 */
export function getCurrentUser(): User | null {
  try {
    const userJson = localStorage.getItem('glossadocs_user');
    if (!userJson) return null;
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}
