import { ApiError } from "../../shared/api-error.js";

export type KeycloakAdminClientErrorCode =
  | "KEYCLOAK_USER_EXISTS"
  | "KEYCLOAK_USER_NOT_FOUND"
  | "KEYCLOAK_ADMIN_UNAVAILABLE";

export class KeycloakAdminClientError extends Error {
  public readonly code: KeycloakAdminClientErrorCode;

  public constructor(code: KeycloakAdminClientErrorCode, message: string) {
    super(message);
    this.name = "KeycloakAdminClientError";
    this.code = code;
  }
}

export interface KeycloakAdminClient {
  createUser(args: { email: string; password: string }): Promise<void>;
  sendPasswordResetEmail(args: { email: string }): Promise<void>;
}

interface KeycloakAdminClientConfig {
  adminUrl: string;
  realm: string;
  adminUsername: string;
  adminPassword: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function getAdminAccessToken(config: KeycloakAdminClientConfig): Promise<string> {
  const tokenUrl = `${normalizeBaseUrl(config.adminUrl)}/realms/master/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: "admin-cli",
    username: config.adminUsername,
    password: config.adminPassword
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  }).catch(() => null);

  if (!response || !response.ok) {
    throw new KeycloakAdminClientError("KEYCLOAK_ADMIN_UNAVAILABLE", "Keycloak admin token request failed");
  }

  const data = (await response.json().catch(() => ({}))) as Partial<{ access_token: string }>;
  if (!data.access_token) {
    throw new KeycloakAdminClientError("KEYCLOAK_ADMIN_UNAVAILABLE", "Keycloak admin token missing");
  }
  return data.access_token;
}

async function keycloakRequest(
  url: string,
  token: string,
  init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> } = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`
    }
  }).catch(() => null);

  if (!response) {
    throw new KeycloakAdminClientError("KEYCLOAK_ADMIN_UNAVAILABLE", "Keycloak admin request failed");
  }
  return response;
}

export class HttpKeycloakAdminClient implements KeycloakAdminClient {
  private readonly config: KeycloakAdminClientConfig;

  public constructor(config: KeycloakAdminClientConfig) {
    this.config = config;
  }

  public async createUser(args: { email: string; password: string }): Promise<void> {
    const token = await getAdminAccessToken(this.config);
    const base = `${normalizeBaseUrl(this.config.adminUrl)}/admin/realms/${encodeURIComponent(
      this.config.realm
    )}`;

    const localPart = args.email.split("@")[0]?.trim() || "GlossaDocs";

    // 1) Create user.
    const createResponse = await keycloakRequest(`${base}/users`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: args.email,
        email: args.email,
        firstName: localPart,
        lastName: "User",
        enabled: true,
        emailVerified: true,
        requiredActions: []
      })
    });

    if (createResponse.status === 409) {
      throw new KeycloakAdminClientError("KEYCLOAK_USER_EXISTS", "User already exists");
    }
    if (!createResponse.ok) {
      throw new KeycloakAdminClientError("KEYCLOAK_ADMIN_UNAVAILABLE", "User creation failed");
    }

    const location = createResponse.headers.get("location");
    const userId = location?.split("/").at(-1);
    if (!userId) {
      throw new KeycloakAdminClientError("KEYCLOAK_ADMIN_UNAVAILABLE", "Created user id missing");
    }

    // 2) Set password.
    const pwResponse = await keycloakRequest(`${base}/users/${encodeURIComponent(userId)}/reset-password`, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "password",
        value: args.password,
        temporary: false
      })
    });

    if (!pwResponse.ok) {
      throw new KeycloakAdminClientError("KEYCLOAK_ADMIN_UNAVAILABLE", "Password set failed");
    }
  }

  public async sendPasswordResetEmail(args: { email: string }): Promise<void> {
    const token = await getAdminAccessToken(this.config);
    const base = `${normalizeBaseUrl(this.config.adminUrl)}/admin/realms/${encodeURIComponent(
      this.config.realm
    )}`;

    // Find by email/username. If not found, treat as not found (caller will avoid leaking).
    const queryUrl = `${base}/users?email=${encodeURIComponent(args.email)}&max=2`;
    const queryResponse = await keycloakRequest(queryUrl, token, { method: "GET" });
    if (!queryResponse.ok) {
      throw new KeycloakAdminClientError("KEYCLOAK_ADMIN_UNAVAILABLE", "User lookup failed");
    }
    const users = (await queryResponse.json().catch(() => [])) as Array<{ id?: string }>;
    const userId = users[0]?.id;
    if (!userId) {
      throw new KeycloakAdminClientError("KEYCLOAK_USER_NOT_FOUND", "User not found");
    }

    const execResponse = await keycloakRequest(
      `${base}/users/${encodeURIComponent(userId)}/execute-actions-email`,
      token,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(["UPDATE_PASSWORD"])
      }
    );
    if (!execResponse.ok) {
      throw new KeycloakAdminClientError("KEYCLOAK_ADMIN_UNAVAILABLE", "Execute actions email failed");
    }
  }
}

export function requireKeycloakAdminConfig(config: Partial<KeycloakAdminClientConfig>): KeycloakAdminClientConfig {
  const { adminUrl, realm, adminUsername, adminPassword } = config;
  if (!adminUrl || !realm || !adminUsername || !adminPassword) {
    throw new ApiError(
      500,
      "CONFIG_KEYCLOAK_ADMIN_INCOMPLETE",
      "Keycloak admin configuration is missing"
    );
  }
  return { adminUrl, realm, adminUsername, adminPassword };
}

