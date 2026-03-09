export interface AuthenticatedPrincipal {
  actorSub: string;
  username: string;
  email: string | null;
  scopes: string[];
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedPrincipal>;
}
