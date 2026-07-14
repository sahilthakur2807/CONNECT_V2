import { Logger } from "../../../../shared/logger/Logger.js";

export class GoogleOAuthProvider {
  getProviderName() {
    return "google";
  }

  async verifyToken(token) {
    // Enable offline mock token verification in testing
    if (
      process.env.NODE_ENV === "test" &&
      token.startsWith("mock-google-token")
    ) {
      const parts = token.split(":");
      const email = parts[1] || "google-test@example.com";
      return {
        providerUserId: `google-uid-${email}`,
        email,
        emailVerified: true,
        name: "Google Test User",
        avatar:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop",
      };
    }

    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
      );
      if (!response.ok) {
        throw new Error(
          `Google validation endpoint returned status: ${response.status}`,
        );
      }

      const body = await response.json();
      if (!body.sub || !body.email) {
        throw new Error(
          "Google token info payload is missing identity coordinates (sub, email)",
        );
      }

      return {
        providerUserId: body.sub,
        email: body.email,
        emailVerified:
          body.email_verified === "true" || body.email_verified === true,
        name: body.name,
        avatar: body.picture,
      };
    } catch (error) {
      Logger.error("Google ID token verification failed", error);
      throw new Error("OAuth token verification failed");
    }
  }
}
export const googleOAuthProvider = new GoogleOAuthProvider();
