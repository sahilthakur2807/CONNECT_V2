export interface OAuthUserPayload {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  avatar?: string;
}

export interface IOAuthProvider {
  /**
   * Returns the lowercased identifier of the provider (e.g. 'google', 'github').
   */
  getProviderName(): string;

  /**
   * Verifies the external auth token/code, returning standard normalized identity payloads.
   */
  verifyToken(token: string): Promise<OAuthUserPayload>;
}
