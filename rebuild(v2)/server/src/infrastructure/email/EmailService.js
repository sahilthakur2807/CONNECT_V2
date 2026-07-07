import nodemailer from "nodemailer";
import { config } from "../../config/index.js";
import { Logger } from "../../shared/logger/Logger.js";

class EmailServiceImpl {
  constructor() {
    this.transport = null;
    this.sender = config.GMAIL_USER;

    if (
      config.GMAIL_USER &&
      config.GMAIL_CLIENT_ID &&
      config.GMAIL_CLIENT_SECRET &&
      config.GMAIL_REFRESH_TOKEN
    ) {
      try {
        this.transport = nodemailer.createTransport({
          service: "gmail",
          auth: {
            type: "OAuth2",
            user: config.GMAIL_USER,
            clientId: config.GMAIL_CLIENT_ID,
            clientSecret: config.GMAIL_CLIENT_SECRET,
            refreshToken: config.GMAIL_REFRESH_TOKEN,
          },
        });
        Logger.info(
          `EmailService: Gmail OAuth2 transporter initialized successfully for ${config.GMAIL_USER}.`,
        );
      } catch (err) {
        Logger.error("EmailService: Failed to initialize Gmail OAuth2 transporter:", err);
      }
    } else {
      Logger.warn(
        "EmailService: Gmail OAuth2 credentials not fully configured. Email operations will fallback to console logging.",
      );
    }
  }

  /**
   * Generates the common responsive email template
   * @param {string} title - Email main title
   * @param {string} body - Email html content
   * @returns {string} Fully styled HTML email
   */
  _getHtmlTemplate(title, body) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f9fafb;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f9fafb;
      padding: 40px 0;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      padding: 40px;
      text-align: center;
    }
    .logo-container {
      display: inline-block;
      width: 48px;
      height: 48px;
      background-color: rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      line-height: 48px;
      text-align: center;
      margin-bottom: 16px;
    }
    .logo-letter {
      color: #ffffff;
      font-size: 24px;
      font-weight: bold;
      font-family: Georgia, serif;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .content {
      padding: 40px;
      color: #374151;
    }
    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 32px 0;
    }
    .footer {
      padding: 0 40px 40px 40px;
      font-size: 12px;
      color: #9ca3af;
      line-height: 1.5;
    }
    .footer a {
      color: #4f46e5;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-container">
          <span class="logo-letter">N</span>
        </div>
        <h1>Connect Network</h1>
      </div>
      <div class="content">
        ${body}
      </div>
      <div class="footer">
        <p>&copy; 2026 Connect Network. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Dispatches verification email
   */
  async sendVerificationEmail(to, username, token) {
    const clientBaseUrl =
      config.CORS_ORIGIN && config.CORS_ORIGIN !== "*"
        ? config.CORS_ORIGIN
        : "http://localhost:5173";
    const verificationUrl = `${clientBaseUrl}/verify-email?token=${token}`;
    const subject = "Verify your Connect Account";

    const body = `
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px; color: #111827;">Verify Your Account, @${username}</h2>
      <p style="font-size: 15px; line-height: 1.625; margin-top: 0; margin-bottom: 24px; color: #4b5563;">Thanks for joining Connect. We're excited to have you in our citizen consensus network. To complete your sign-up and unlock all features, please verify your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verificationUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 16px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);" target="_blank">Confirm Email Address</a>
      </div>
      <p style="font-size: 15px; line-height: 1.625; color: #4b5563;">If the button doesn't work, copy and paste this verification token into your browser:</p>
      <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; font-family: monospace; font-size: 13px; word-break: break-all; margin-bottom: 20px; text-align: center; color: #374151;">${token}</div>
      <p style="font-size: 13px; color: #6b7280; word-break: break-all;">
        <a href="${verificationUrl}" target="_blank" style="color: #4f46e5; text-decoration: none;">${verificationUrl}</a>
      </p>
      <div class="divider"></div>
      <p style="font-size: 13px; color: #6b7280; margin-bottom: 0;">This link will expire in 24 hours. If you did not sign up for Connect, you can safely ignore this email.</p>
    `;

    const html = this._getHtmlTemplate(subject, body);

    if (!this.transport) {
      Logger.info(`[MOCK EMAIL DISPATCH - GMAIL FALLBACK]
-----------------------------------------
TYPE: Verification Email
FROM: ${this.sender || "fallback@connect.com"}
TO: ${to}
SUBJECT: ${subject}
VERIFICATION LINK: ${verificationUrl}
TOKEN: ${token}
-----------------------------------------`);
      return { messageId: "mock-gmail-id-success" };
    }

    try {
      const response = await this.transport.sendMail({
        from: `"Connect" <${this.sender}>`,
        to,
        subject,
        html,
      });
      Logger.info(`EmailService: Verification email successfully sent to ${to}. ID: ${response.messageId}`);
      return response;
    } catch (err) {
      Logger.error(`EmailService: Failed to send verification email to ${to}:`, err);
      throw err;
    }
  }

  /**
   * Dispatches password reset email
   */
  async sendPasswordResetEmail(to, username, token) {
    const clientBaseUrl =
      config.CORS_ORIGIN && config.CORS_ORIGIN !== "*"
        ? config.CORS_ORIGIN
        : "http://localhost:5173";
    const resetUrl = `${clientBaseUrl}/reset-password?token=${token}`;
    const subject = "Reset your Connect Password";

    const body = `
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px; color: #111827;">Password Reset Request, @${username}</h2>
      <p style="font-size: 15px; line-height: 1.625; margin-top: 0; margin-bottom: 24px; color: #4b5563;">You are receiving this email because you (or someone else) requested a password reset for your account. Please click the button below to complete the process:</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 16px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);" target="_blank">Reset Password</a>
      </div>
      <p style="font-size: 15px; line-height: 1.625; color: #4b5563;">If the button doesn't work, copy and paste this reset token into your browser:</p>
      <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; font-family: monospace; font-size: 13px; word-break: break-all; margin-bottom: 20px; text-align: center; color: #374151;">${token}</div>
      <p style="font-size: 13px; color: #6b7280; word-break: break-all;">
        <a href="${resetUrl}" target="_blank" style="color: #4f46e5; text-decoration: none;">${resetUrl}</a>
      </p>
      <div class="divider"></div>
      <p style="font-size: 13px; color: #6b7280; margin-bottom: 0;">This reset link will expire in 1 hour. If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
    `;

    const html = this._getHtmlTemplate(subject, body);

    if (!this.transport) {
      Logger.info(`[MOCK EMAIL DISPATCH - GMAIL FALLBACK]
-----------------------------------------
TYPE: Password Reset Email
FROM: ${this.sender || "fallback@connect.com"}
TO: ${to}
SUBJECT: ${subject}
RESET LINK: ${resetUrl}
TOKEN: ${token}
-----------------------------------------`);
      return { messageId: "mock-gmail-id-success" };
    }

    try {
      const response = await this.transport.sendMail({
        from: `"Connect" <${this.sender}>`,
        to,
        subject,
        html,
      });
      Logger.info(`EmailService: Password reset email successfully sent to ${to}. ID: ${response.messageId}`);
      return response;
    } catch (err) {
      Logger.error(`EmailService: Failed to send password reset email to ${to}:`, err);
      throw err;
    }
  }

  /**
   * Dispatches welcome email
   */
  async sendWelcomeEmail(to, username) {
    const clientBaseUrl =
      config.CORS_ORIGIN && config.CORS_ORIGIN !== "*"
        ? config.CORS_ORIGIN
        : "http://localhost:5173";
    const homeUrl = `${clientBaseUrl}/home`;
    const subject = "Welcome to Connect!";

    const body = `
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px; color: #111827;">Welcome to Connect, @${username}!</h2>
      <p style="font-size: 15px; line-height: 1.625; margin-top: 0; margin-bottom: 24px; color: #4b5563;">Your email address has been successfully verified! Your account is now fully authorized, and you can access the home feed, join discussion rooms, create communities, and make allies across the network.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${homeUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 16px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);" target="_blank">Go to Home Feed</a>
      </div>
      <p style="font-size: 15px; line-height: 1.625; color: #4b5563;">We are thrilled to have you as a citizen in our consensus engine. Seek agreement, build reputation, and connect with people who share your insights.</p>
      <div class="divider"></div>
      <p style="font-size: 13px; color: #6b7280; margin-bottom: 0;">If you have any questions or require assistance, please feel free to reach out to our network administrators.</p>
    `;

    const html = this._getHtmlTemplate(subject, body);

    if (!this.transport) {
      Logger.info(`[MOCK EMAIL DISPATCH - GMAIL FALLBACK]
-----------------------------------------
TYPE: Welcome Email
FROM: ${this.sender || "fallback@connect.com"}
TO: ${to}
SUBJECT: ${subject}
PORTAL LINK: ${homeUrl}
-----------------------------------------`);
      return { messageId: "mock-gmail-id-success" };
    }

    try {
      const response = await this.transport.sendMail({
        from: `"Connect" <${this.sender}>`,
        to,
        subject,
        html,
      });
      Logger.info(`EmailService: Welcome email successfully sent to ${to}. ID: ${response.messageId}`);
      return response;
    } catch (err) {
      Logger.error(`EmailService: Failed to send welcome email to ${to}:`, err);
      throw err;
    }
  }

  /**
   * Dispatches login notification email
   */
  async sendLoginNotificationEmail(to, username, ipAddress) {
    const subject = "New Sign-in to your Connect Account";

    const body = `
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px; color: #111827;">New Sign-in Detected, @${username}</h2>
      <p style="font-size: 15px; line-height: 1.625; margin-top: 0; margin-bottom: 24px; color: #4b5563;">Your Connect account was just signed into from a new device or location.</p>
      <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 24px 0; font-family: sans-serif; font-size: 14px; color: #374151; line-height: 1.5;">
        <strong>Time:</strong> ${new Date().toLocaleString()}<br>
        <strong>IP Address:</strong> ${ipAddress}<br>
        <strong>Device:</strong> Web Browser
      </div>
      <p style="font-size: 15px; line-height: 1.625; color: #4b5563;">If this was you, no action is needed. If you do not recognize this login, please change your password immediately to secure your account.</p>
    `;

    const html = this._getHtmlTemplate(subject, body);

    if (!this.transport) {
      Logger.info(`[MOCK EMAIL DISPATCH - GMAIL FALLBACK]
-----------------------------------------
TYPE: Login Notification Email
FROM: ${this.sender || "fallback@connect.com"}
TO: ${to}
SUBJECT: ${subject}
IP ADDRESS: ${ipAddress}
-----------------------------------------`);
      return { messageId: "mock-gmail-id-success" };
    }

    try {
      const response = await this.transport.sendMail({
        from: `"Connect" <${this.sender}>`,
        to,
        subject,
        html,
      });
      Logger.info(`EmailService: Login notification email successfully sent to ${to}. ID: ${response.messageId}`);
      return response;
    } catch (err) {
      Logger.error(`EmailService: Failed to send login notification email to ${to}:`, err);
      throw err;
    }
  }
}

export const EmailService = new EmailServiceImpl();
