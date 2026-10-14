import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Delivery channels for reminders. Each is switched on by its environment
// variables; when they are missing the channel is simply skipped.

export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export function whatsappConfigured() {
  return Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE,
  );
}

let transport: Transporter | null = null;

export async function sendEmail(to: string, subject: string, text: string, html: string) {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
}

/** Indian 10-digit numbers get the 91 country code; returns digits only. */
export function normalizeWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return null;
}

/**
 * Sends an approved WhatsApp Business template through the Meta Cloud API.
 * Business-initiated messages must use a template; the template's body
 * placeholders are filled from `params` in order.
 */
export async function sendWhatsAppTemplate(phone: string, params: string[]) {
  const to = normalizeWhatsAppNumber(phone);
  if (!to) throw new Error(`Phone number ${phone} is not a valid Indian mobile number`);
  const res = await fetch(
    `${process.env.WHATSAPP_API_BASE ?? "https://graph.facebook.com/v21.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
