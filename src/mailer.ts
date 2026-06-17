import { RESEND_API_KEY, FROM_EMAIL } from "./config";
import business from "./business.json";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function sendConfirmationEmail(params: {
  to: string;
  customerName: string;
  service: string;
  address: string;
  slot: string;
}): Promise<void> {
  if (!RESEND_API_KEY) return;

  const body = {
    from: FROM_EMAIL,
    to: params.to,
    subject: `Appointment Confirmed — ${params.service}`,
    html: `
      <h2>Your appointment is confirmed!</h2>
      <p>Hi ${escapeHtml(params.customerName)},</p>
      <p>We've scheduled your <strong>${escapeHtml(params.service)}</strong> appointment for <strong>${escapeHtml(params.slot)}</strong> at ${escapeHtml(params.address)}.</p>
      <p>Our technician will arrive during the scheduled window. If you need to reschedule, call us at <strong>${business.phone}</strong>.</p>
      <p>— ${business.name}</p>
    `,
  };

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function sendInternalNotification(params: {
  customerName: string;
  service: string;
  address: string;
  urgency: string;
  slot?: string;
  sessionId: string;
}): Promise<void> {
  if (!RESEND_API_KEY) return;

  const body = {
    from: FROM_EMAIL,
    to: business.notifyEmail,
    subject: `[${params.urgency.toUpperCase()}] New Lead: ${params.customerName} — ${params.service}`,
    html: `
      <h3>New qualified lead</h3>
      <ul>
        <li><strong>Name:</strong> ${escapeHtml(params.customerName)}</li>
        <li><strong>Service:</strong> ${escapeHtml(params.service)}</li>
        <li><strong>Address:</strong> ${escapeHtml(params.address)}</li>
        <li><strong>Urgency:</strong> ${escapeHtml(params.urgency)}</li>
        ${params.slot ? `<li><strong>Booked slot:</strong> ${escapeHtml(params.slot)}</li>` : ""}
        <li><strong>Session:</strong> ${escapeHtml(params.sessionId)}</li>
      </ul>
    `,
  };

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
