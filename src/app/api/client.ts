const DEFAULT_API_BASE_URL = "http://localhost:4000";

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code?: string;

  public constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

/** User-facing copy when PUT/POST body exceeds the API limit (inline images, huge HTML). */
export const DOCUMENT_PAYLOAD_TOO_LARGE_MESSAGE =
  "Couldn’t save: the document is too large for the server. Embedded images and long content count toward this limit—try smaller images, fewer images, or ask your administrator to raise the API body size limit.";

function getApiErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiClientError) {
    return error.status;
  }
  if (error && typeof error === "object" && "status" in error) {
    const s = (error as { status: unknown }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

/** True when the server rejected the request because the JSON body was too large (Fastify 413 / PAYLOAD_TOO_LARGE). */
export function isPayloadTooLargeError(error: unknown): boolean {
  return getApiErrorStatus(error) === 413;
}

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Pass to `fetch` so callers can time out long requests (e.g. session bootstrap). */
  signal?: AbortSignal;
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (typeof configured === "string" && configured.trim().length > 0) {
    // Avoid double slashes when joining paths like `${base}/auth/login` (Amplify env often has a trailing slash).
    return configured.trim().replace(/\/+$/, "");
  }
  return DEFAULT_API_BASE_URL;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "include",
    signal: options.signal
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiClientError(
      (data as { message?: string }).message ?? "Request failed",
      response.status,
      (data as { code?: string }).code
    );
  }

  return data as T;
}
