/**
 * Email Service Abstraction — Resend Production Driver with Hardened Fail-Closed Behavior
 *
 * ADR-011: Abstract EmailService interface backed by Resend API.
 *
 * Production Invariants:
 * - When EMAIL_PROVIDER=resend, valid RESEND_API_KEY and EMAIL_FROM_ADDRESS are strictly required.
 * - Missing credentials FAIL CLOSED with a ServiceConfigurationError; silent fallback to mock is FORBIDDEN.
 * - Never returns fake success=true when an email cannot be delivered.
 * - Mock provider is permitted ONLY when explicitly configured (EMAIL_PROVIDER=mock) in non-production environments.
 * - Attempting to send via MockEmailService in production (NODE_ENV=production) strictly throws a ServiceConfigurationError.
 */

import { Resend } from "resend";
import { getAppUrl } from "@/lib/config";
import { logger } from "@/lib/logger";

// =============================================================================
// ERRORS
// =============================================================================

export class ServiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceConfigurationError";
  }
}

// =============================================================================
// INTERFACES
// =============================================================================

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailService {
  send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// =============================================================================
// MOCK IMPLEMENTATION (Explicit mock provider only — Forbidden in Production)
// =============================================================================

export class MockEmailService implements EmailService {
  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (process.env.NODE_ENV === "production") {
      throw new ServiceConfigurationError(
        "CRITICAL: EMAIL_PROVIDER='mock' cannot be executed in production. Production must use EMAIL_PROVIDER='resend' with valid credentials."
      );
    }

    const messageId = `mock_${Date.now()}`;
    logger.info("Mock email sent", {
      service: "EmailService",
      provider: "mock",
      operation: "send",
      subject: options.subject,
      messageId,
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[EmailService Mock] HTML Content:", options.html);
    }

    return { success: true, messageId };
  }
}

// =============================================================================
// RESEND IMPLEMENTATION (Production default — Fails Closed)
// =============================================================================

export class ResendEmailService implements EmailService {
  private resend: Resend | null = null;
  private configError: string | null = null;
  private fromAddress: string | null = null;

  constructor() {
    this.validateAndInitialize();
  }

  private validateAndInitialize(): void {
    const provider = process.env.EMAIL_PROVIDER;
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM_ADDRESS ?? process.env.EMAIL_FROM;

    const missing: string[] = [];
    if (process.env.NODE_ENV === "production" && (!provider || !provider.trim())) {
      missing.push("EMAIL_PROVIDER");
    }
    if (!apiKey || !apiKey.trim()) missing.push("RESEND_API_KEY");
    if (!from || !from.trim()) missing.push("EMAIL_FROM_ADDRESS");

    if (missing.length > 0) {
      this.configError = `Missing required email configuration: ${missing.join(", ")} must be set when EMAIL_PROVIDER=resend.`;
    } else {
      this.resend = new Resend(apiKey);
      this.fromAddress = from!.trim();
    }
  }

  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // FAIL CLOSED: If configuration is invalid, throw clear server configuration error immediately
    if (this.configError || !this.resend || !this.fromAddress) {
      logger.error("Email service misconfigured", {
        service: "EmailService",
        provider: "resend",
        operation: "send",
        errorMessage: this.configError ?? "Client uninitialized",
      });
      throw new ServiceConfigurationError(this.configError ?? "Email service misconfigured.");
    }

    const startTime = Date.now();
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      const durationMs = Date.now() - startTime;

      if (error) {
        // Structured server-side logging without leaking recipient PII or provider secrets
        logger.error("Email delivery failed", {
          service: "EmailService",
          provider: "resend",
          operation: "send",
          durationMs,
          errorCode: error.name,
          errorMessage: error.message,
          subject: options.subject,
        });
        return { success: false, error: "Email delivery failed. Please check server logs." };
      }

      if (!data?.id) {
        logger.error("Email service did not return message ID", {
          service: "EmailService",
          provider: "resend",
          operation: "send",
          durationMs,
        });
        return { success: false, error: "Email service did not return delivery confirmation." };
      }

      logger.info("Email delivered", {
        service: "EmailService",
        provider: "resend",
        operation: "send",
        durationMs,
        messageId: data.id,
      });

      return { success: true, messageId: data.id };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      logger.error("Email delivery exception occurred", {
        service: "EmailService",
        provider: "resend",
        operation: "send",
        durationMs,
        errorCode: err?.name ?? "EmailException",
        errorMessage: err?.message ?? "Unknown exception",
        subject: options.subject,
      });
      return { success: false, error: "Email delivery exception occurred." };
    }
  }
}

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@universalcrm.com";
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? EMAIL_FROM;

export const EmailTemplates = {
  passwordReset(token: string, name: string): EmailOptions {
    const link = `${getAppUrl()}/reset-password?token=${token}`;
    return {
      to: "", // Set by caller
      subject: "Reset your Universal CRM password",
      text: `Hi ${name}, reset your password here: ${link}. This link expires in 1 hour.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset your password</h2>
          <p>Hi ${name},</p>
          <p>Click the button below to reset your password. This link expires in 1 hour.</p>
          <a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;">
            Reset Password
          </a>
          <p style="margin-top:24px;color:#6b7280;font-size:14px;">
            If you didn't request this, ignore this email. Your password won't change.
          </p>
          <p style="color:#6b7280;font-size:14px;">Link: ${link}</p>
        </div>
      `,
    };
  },

  invitation(token: string, inviterName: string, companyName: string): EmailOptions {
    const link = `${getAppUrl()}/app/invite/${token}`;
    return {
      to: "", // Set by caller
      subject: `You've been invited to ${companyName} on Universal CRM`,
      text: `Hi, ${inviterName} invited you to join ${companyName}. Accept here: ${link}. Expires in 7 days.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You're invited to join ${companyName}</h2>
          <p>${inviterName} has invited you to join their CRM workspace.</p>
          <a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;">
            Accept Invitation
          </a>
          <p style="margin-top:24px;color:#6b7280;font-size:14px;">
            This invitation expires in 7 days.
          </p>
          <p style="color:#6b7280;font-size:14px;">Link: ${link}</p>
        </div>
      `,
    };
  },
};

export { EMAIL_FROM, EMAIL_FROM_ADDRESS };

// =============================================================================
// FACTORY
// =============================================================================

export function createEmailService(): EmailService {
  const provider = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase().trim();

  if (provider === "mock") {
    return new MockEmailService();
  }

  if (provider === "resend") {
    return new ResendEmailService();
  }

  throw new ServiceConfigurationError(
    `Unsupported EMAIL_PROVIDER='${provider}'. Valid options: 'resend' (production) or 'mock' (dev/test only).`
  );
}

// Export singleton instance
export const emailService = createEmailService();

/**
 * Direct sendEmail helper function
 * Exactly matches sendEmail(to, subject, html, text?) signature.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return emailService.send({ to, subject, html, text });
}
