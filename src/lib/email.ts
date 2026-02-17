import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// SMTP Configuration (reads from environment)
// ---------------------------------------------------------------------------

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "NMH EMS Dashboard <noreply@northmemorial.com>";

/**
 * Check if SMTP email is configured. Returns false in dev if env vars are missing.
 * This allows the app to run without email — notifications are silently skipped.
 */
export function isEmailConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

// Lazy-initialized transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

// ---------------------------------------------------------------------------
// Send Email
// ---------------------------------------------------------------------------

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an email. Returns success/error without throwing.
 * If SMTP is not configured, returns success: false with a descriptive message.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    console.warn("[email] SMTP not configured — skipping email:", options.subject);
    return { success: false, error: "SMTP not configured" };
  }

  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: SMTP_FROM,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    console.error("[email] Failed to send:", message);
    return { success: false, error: message };
  }
}
