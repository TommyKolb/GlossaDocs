export function getCognitoErrorName(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  return (error as { name?: string }).name;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return typeof (error as { message?: unknown })?.message === "string"
    ? (error as { message: string }).message
    : fallback;
}
