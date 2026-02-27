import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, subject, message } = req.body || {};

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Email service not configured" });
  }

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from: "MontraFi Support <support@montrafinance.com>",
      to: "montrafinance@outlook.com",
      replyTo: email,
      subject: `[Support] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
    });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Resend error:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
}
