import { createHmac } from "node:crypto";

export function computeCognitoSecretHash(
  username: string,
  clientId: string,
  clientSecret: string
): string {
  return createHmac("sha256", clientSecret).update(`${username}${clientId}`).digest("base64");
}
