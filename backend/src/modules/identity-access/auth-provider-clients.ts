export interface AuthPasswordLoginClient {
  loginWithPassword(args: { username: string; password: string }): Promise<{
    accessToken: string;
    expiresInSeconds: number;
  }>;
}

export interface AuthAdminClient {
  createUser(args: { email: string; password: string }): Promise<void>;
  sendPasswordResetEmail(args: { email: string }): Promise<void>;
}
