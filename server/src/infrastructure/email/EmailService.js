import nodemailer from "nodemailer";
import os from "os";
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
   * Helper to retrieve non-internal IPv4 address for LAN network host access
   * @returns {string} e.g. "10.10.60.196" or "localhost" fallback
   */
  _getNetworkHostIp() {
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
          if (net.family === "IPv4" && !net.internal) {
            return net.address;
          }
        }
      }
    } catch (err) {
      // Fallback if OS network lookup fails
    }
    return "localhost";
  }

  /**
   * Resolves client base network URL for email action links.
   * Dynamically uses network host IP so all users on the network can access email links.
   * @returns {string} Clean base URL without trailing slash
   */
  _getClientBaseUrl() {
    let url = config.CLIENT_URL;

    if (!url && config.CORS_ORIGIN && config.CORS_ORIGIN !== "*") {
      const origin = config.CORS_ORIGIN.split(",")[0].trim();
      if (origin !== "*") {
        url = origin;
      }
    }

    const networkIp = this._getNetworkHostIp();
    const defaultPort = process.env.VITE_PORT || "5173";

    if (!url) {
      return `http://${networkIp}:${defaultPort}`;
    }

    url = url.replace(/\/$/, "");
    if (url.includes("localhost") || url.includes("127.0.0.1")) {
      url = url.replace("localhost", networkIp).replace("127.0.0.1", networkIp);
    }

    return url;
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
    const clientBaseUrl = this._getClientBaseUrl();
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
    const clientBaseUrl = this._getClientBaseUrl();
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
    const clientBaseUrl = this._getClientBaseUrl();
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
    const clientBaseUrl = this._getClientBaseUrl();
    const profileUrl = `${clientBaseUrl}/profile`;
    const subject = "New Sign-in to your Connect Account";

    const body = `
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px; color: #111827;">New Sign-in Detected, @${username}</h2>
      <p style="font-size: 15px; line-height: 1.625; margin-top: 0; margin-bottom: 24px; color: #4b5563;">Your Connect account was just signed into from a new device or location.</p>
      <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 24px 0; font-family: sans-serif; font-size: 14px; color: #374151; line-height: 1.5;">
        <strong>Time:</strong> ${new Date().toLocaleString()}<br>
        <strong>IP Address:</strong> ${ipAddress}<br>
        <strong>Device:</strong> Web Browser
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${profileUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 16px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);" target="_blank">Account Security Settings</a>
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

  /**
   * Dispatches reply notification email.
   * Renders the full conversation thread as a nested, pixel-faithful static snapshot
   * of the MessageCard component tree — avatar, name, timestamp, "replying to @X",
   * thread connector lines, consecutive grouping, and highlighted new reply.
   *
   * @param {string}   to
   * @param {string}   parentUsername
   * @param {string}   parentContent
   * @param {string}   replyUsername
   * @param {string}   replyContent
   * @param {string}   roomId
   * @param {string}   roomTitle
   * @param {object[]} ancestorChain  – [rootMessage, ..., parentMessage]
   * @param {object[]} priorReplies   – siblings before newReply (same parentId)
   */
  async sendReplyNotificationEmail(
    to, parentUsername, parentContent, replyUsername, replyContent,
    roomId, roomTitle = "Discussion Room", ancestorChain = [], priorReplies = []
  ) {
    const clientBaseUrl = this._getClientBaseUrl();
    const roomUrl = `${clientBaseUrl}/room/${roomId}`;
    const subject = `@${replyUsername} replied to your message in "${roomTitle}"`;

    // ── Design tokens (globals.css :root) ──────────────────────────────
    const FG       = "#111827";
    const MUTED_FG = "#6b7280";
    const BORDER   = "#e5e7eb";
    const SECONDARY= "#f3f4f6";
    const MUTED_BG = "#f9fafb";
    const PRIMARY  = "#dc2626";   // red-600 — app primary

    // ── Helpers ────────────────────────────────────────────────────────
    const avatarBg = (name) => {
      const palette = ["#dc2626","#ea580c","#d97706","#16a34a","#2563eb","#7c3aed","#db2777","#0891b2"];
      let h = 0;
      for (let i = 0; i < (name || "?").length; i++) h = (name.charCodeAt(i) + ((h << 5) - h)) | 0;
      return palette[Math.abs(h) % palette.length];
    };
    const initial  = (n) => (n || "?").charAt(0).toUpperCase();
    const fmtTime  = (iso) => {
      if (!iso) return "";
      try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
      catch { return ""; }
    };

    /**
     * Render one MessageCard row.
     * isConsecutive = same user as previous → no avatar, no header, small timestamp on left.
     */
    const renderCard = (msg, opts = {}) => {
      const { isConsecutive = false, isHighlighted = false, replyingTo = null } = opts;
      const u            = msg.user || {};
      const displayName  = u.name || u.username || "Unknown";
      const username     = u.username || displayName;
      const ts           = fmtTime(msg.createdAt);

      // Avatar / time-gutter cell (42 px wide — matches component's w-8 + gap)
      const gutterCell = isConsecutive
        ? `<td width="42" valign="top" style="padding-right:8px;text-align:right;padding-top:3px;">
             <span style="font-size:9px;color:#9ca3af;font-family:'Courier New',monospace;">${ts}</span>
           </td>`
        : `<td width="42" valign="top" style="padding-right:10px;padding-top:2px;">
             ${u.avatar
               ? `<img src="${u.avatar}" width="32" height="32" alt="${displayName}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;display:block;" />`
               : `<table role="presentation" width="32" height="32" cellpadding="0" cellspacing="0" border="0" style="width:32px;height:32px;border-collapse:collapse;background:${avatarBg(displayName)};border-radius:8px;display:inline-table;">
                    <tr>
                      <td align="center" valign="middle" style="color:#ffffff;font-size:13px;font-weight:800;font-family:sans-serif;text-align:center;vertical-align:middle;line-height:32px;padding:0;width:32px;height:32px;">
                        ${initial(displayName)}
                      </td>
                    </tr>
                  </table>`
             }
           </td>`;

      // Header row (hidden for consecutive messages)
      const header = isConsecutive ? "" : `
        <div style="margin-bottom:2px;line-height:1.4;">
          <span style="font-size:13px;font-weight:700;color:${FG};letter-spacing:-0.01em;">${displayName}</span>
          <span style="font-size:11px;color:${MUTED_FG};margin-left:3px;">@${username}</span>
          ${replyingTo ? `<span style="font-size:11px;color:${MUTED_FG};"> replying to <span style="color:${PRIMARY};font-weight:700;">@${replyingTo}</span></span>` : ""}
          ${ts ? `<span style="font-size:10px;color:#9ca3af;font-family:'Courier New',monospace;margin-left:5px;">${ts}</span>` : ""}
          ${isHighlighted ? `<span style="display:inline-block;background:${PRIMARY};color:#fff;font-size:9px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:1px 6px;border-radius:4px;margin-left:6px;vertical-align:middle;">NEW</span>` : ""}
        </div>`;

      // Card wrapper style
      const wrapStyle = isHighlighted
        ? `border:1.5px solid ${PRIMARY};border-radius:10px;padding:8px 10px;margin:0 0 4px 0;background:linear-gradient(135deg,#fff5f5 0%,#fff 100%);`
        : `padding:${isConsecutive ? "1px 10px 4px" : "5px 10px 4px"};margin:0 0 1px 0;`;

      return `
        <div style="${wrapStyle}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${gutterCell}
              <td valign="top">
                ${header}
                <div style="font-size:13.5px;line-height:1.5;color:${FG};white-space:pre-wrap;word-break:break-word;">${msg.content}</div>
              </td>
            </tr>
          </table>
        </div>`;
    };

    /**
     * Recursively build the nested thread HTML.
     * chain[0]  = current depth's message
     * chain[1+] = deeper ancestors down to parentMessage
     * At the leaf (chain.length === 1): render priorReplies + newReply.
     */
    const buildThread = (chain, depth = 0) => {
      if (!chain || chain.length === 0) return "";

      const current       = chain[0];
      const rest          = chain.slice(1);
      // Who this message is replying to (for depth > 0, it's the previous ancestor's username)
      const replyingToLabel = depth > 0 ? (chain[0]?.user?.username || null) : null;

      // The card for this level (no "replying to" on root; shown from depth 1+)
      let html = renderCard(current, { replyingTo: depth > 0 ? null : null });

      // Build the child section (everything nested under this card)
      let childHtml = "";

      if (rest.length > 0) {
        // More ancestors → recurse
        childHtml = buildThread(rest, depth + 1);
      } else {
        // Leaf: render priorReplies + new reply
        const parentUsername = current.user?.username || parentUsername;
        let prevUserId = null;

        for (const r of priorReplies) {
          const consecutive = prevUserId !== null && prevUserId === r.userId;
          childHtml += renderCard(r, {
            isConsecutive: consecutive,
            replyingTo: consecutive ? null : parentUsername,
          });
          prevUserId = r.userId;
        }

        // New reply (highlighted)
        const newConsecutive = prevUserId !== null && prevUserId === replyUsername;
        const newMsg = {
          content: replyContent,
          createdAt: new Date().toISOString(),
          user: { username: replyUsername, name: replyUsername, avatar: null }
        };
        childHtml += renderCard(newMsg, {
          isConsecutive: newConsecutive,
          isHighlighted: true,
          replyingTo: newConsecutive ? null : parentUsername,
        });
      }

      if (childHtml) {
        // Wrap children with the thread connector line (border-left), like the component's pl-3 ml-0.5
        html += `
          <div style="margin-left:20px;padding-left:14px;border-left:2px solid ${BORDER};padding-top:2px;padding-bottom:2px;">
            ${childHtml}
          </div>`;
      }

      return html;
    };

    // Ensure we always have at least [parentMessage] in the chain
    const chain = ancestorChain && ancestorChain.length > 0
      ? ancestorChain
      : [{ content: parentContent, user: { username: parentUsername, name: parentUsername, avatar: null } }];

    const threadHtml = buildThread(chain);

    const body = `
      <!-- Room chip -->
      <div style="display:inline-flex;align-items:center;gap:6px;background:${SECONDARY};border:1px solid ${BORDER};border-radius:999px;padding:4px 14px 4px 10px;margin-bottom:20px;">
        <span style="font-size:14px;">💬</span>
        <span style="font-size:11px;font-weight:700;color:${MUTED_FG};text-transform:uppercase;letter-spacing:0.1em;font-family:'Courier New',monospace;">${roomTitle}</span>
      </div>

      <h2 style="font-size:18px;font-weight:800;margin:0 0 4px 0;color:${FG};letter-spacing:-0.02em;">Someone replied to your take</h2>
      <p style="font-size:14px;color:${MUTED_FG};margin:0 0 20px 0;line-height:1.5;">
        <strong style="color:${FG};">@${replyUsername}</strong> replied in <strong style="color:${FG};">${roomTitle}</strong>. Here's the full thread:
      </p>

      <!-- Thread panel -->
      <div style="background:${MUTED_BG};border:1px solid ${BORDER};border-radius:14px;padding:12px 10px 10px 10px;margin-bottom:24px;">
        ${threadHtml}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:24px 0 8px 0;">
        <a href="${roomUrl}"
           style="display:inline-block;background:${PRIMARY};color:#fff !important;font-weight:700;font-size:14px;text-decoration:none;padding:13px 32px;border-radius:12px;letter-spacing:0.01em;"
           target="_blank">Open Room &amp; Reply</a>
      </div>
      <div class="divider"></div>
      <p style="font-size:12px;color:#9ca3af;margin-bottom:0;">You received this because you are a member of Connect. Manage preferences in your profile settings.</p>
    `;

    const html = this._getHtmlTemplate(subject, body);

    if (!this.transport) {
      Logger.info(`[MOCK EMAIL DISPATCH - GMAIL FALLBACK]
-----------------------------------------
TYPE: Reply Notification Email
FROM: ${this.sender || "fallback@connect.com"}
TO: ${to}
SUBJECT: ${subject}
ROOM: ${roomTitle}
ROOM LINK: ${roomUrl}
THREAD DEPTH: ${chain.length}
PRIOR REPLIES: ${priorReplies.length}
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
      Logger.info(`EmailService: Reply notification email successfully sent to ${to}. ID: ${response.messageId}`);
      return response;
    } catch (err) {
      Logger.error(`EmailService: Failed to send reply notification email to ${to}:`, err);
      throw err;
    }
  }
}

export const EmailService = new EmailServiceImpl();

