import { GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_CALENDAR_ID } from "./config";
import business from "./business.json";

interface Slot {
  start: string;
  end: string;
  label: string;
}

async function getAuth() {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) return null;
  try {
    const { google } = await import("@googleapis/calendar");
    const { GoogleAuth } = await import("google-auth-library");
    const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    return { google, auth };
  } catch {
    return null;
  }
}

function mockSlots(urgency: string): Slot[] {
  const now = new Date();
  const slots: Slot[] = [];
  const daysAhead = urgency === "emergency" || urgency === "high" ? 0 : business.bookingLeadDays;

  for (let d = daysAhead; d < daysAhead + 4; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    const dow = day.getDay();
    if (dow === 0) continue; // closed Sunday

    for (const hour of [9, 13, 15]) {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setHours(hour + 2);
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: start.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: business.timezone,
        }),
      });
    }
    if (slots.length >= 6) break;
  }
  return slots.slice(0, 4);
}

export async function getAvailableSlots(urgency: string): Promise<Slot[]> {
  const ctx = await getAuth();
  if (!ctx) return mockSlots(urgency);

  try {
    const { google, auth } = ctx;
    const calendar = google.calendar({ version: "v3", auth: auth as any });
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        items: [{ id: GOOGLE_CALENDAR_ID }],
      },
    });

    const busy = res.data.calendars?.[GOOGLE_CALENDAR_ID]?.busy ?? [];
    const busyRanges = busy.map((b: any) => ({
      start: new Date(b.start).getTime(),
      end: new Date(b.end).getTime(),
    }));

    const candidates = mockSlots(urgency);
    return candidates.filter((slot) => {
      const s = new Date(slot.start).getTime();
      const e = new Date(slot.end).getTime();
      return !busyRanges.some((b) => s < b.end && e > b.start);
    });
  } catch {
    return mockSlots(urgency);
  }
}

interface LeadFields {
  name: string;
  service: string;
  address: string;
  urgency?: string;
  phone?: string;
  email?: string;
}

export async function createCalendarEvent(
  sessionId: string,
  lead: LeadFields,
  slot: Slot
): Promise<string | null> {
  const ctx = await getAuth();
  if (!ctx) return null;

  const description = [
    `Service: ${lead.service}`,
    `Address: ${lead.address}`,
    lead.urgency ? `Urgency: ${lead.urgency}` : null,
    lead.phone   ? `Phone: ${lead.phone}`     : null,
    lead.email   ? `Email: ${lead.email}`     : null,
    `Session: ${sessionId}`,
  ].filter(Boolean).join("\n");

  try {
    const { google, auth } = ctx;
    const calendar = google.calendar({ version: "v3", auth: auth as any });
    const event = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: `${lead.service} — ${lead.name}`,
        description,
        start: { dateTime: slot.start, timeZone: business.timezone },
        end: { dateTime: slot.end, timeZone: business.timezone },
      },
    });
    return event.data.id ?? null;
  } catch {
    return null;
  }
}
