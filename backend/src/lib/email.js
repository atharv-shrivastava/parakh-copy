import crypto from "node:crypto";

export function createEmailOtp(email) {
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const secret = process.env.AUTH_OTP_SECRET;
  if (!secret) throw new Error("AUTH_OTP_SECRET is not configured");
  const hash = crypto.createHmac("sha256", secret).update(`${String(email).toLowerCase()}:${otp}`).digest("hex");
  return { otp, hash };
}

export function verifyEmailOtp(email, otp, expectedHash) {
  const secret = process.env.AUTH_OTP_SECRET;
  if (!secret || !expectedHash) return false;
  const actual = crypto.createHmac("sha256", secret).update(`${String(email).toLowerCase()}:${String(otp)}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expectedHash, "hex"));
}

export async function sendVerificationEmail({ to, name, otp }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL are required to send verification emails");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Verify your PARAKH account",
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px"><h2>Verify your PARAKH account</h2><p>Hello ${String(name).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))},</p><p>Your email verification code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 0">${otp}</div><p>This code expires in 10 minutes. If you did not create this account, you can ignore this email.</p></div>`
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Email provider rejected the message (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
}
