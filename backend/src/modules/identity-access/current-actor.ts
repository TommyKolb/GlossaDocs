import { ApiError } from "../../shared/api-error.js";

export function requireActorSub(request: { requestContext: { actorSub: string | null } | null }): string {
  const actorSub = request.requestContext?.actorSub ?? null;
  if (!actorSub) {
    throw new ApiError(401, "AUTH_MISSING_ACTOR", "Authenticated actor was not resolved");
  }
  return actorSub;
}
