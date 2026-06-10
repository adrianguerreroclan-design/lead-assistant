export interface Lead {
  sessionId: string;
  name?: string;
  service?: string;
  address?: string;
  urgency?: "low" | "medium" | "high" | "emergency";
  phone?: string;
  email?: string;
  notes?: string;
  bookingProposed?: boolean;
  bookedSlot?: string;
  calendarEventId?: string;
  createdAt: number;
  updatedAt: number;
}

const leads = new Map<string, Lead>();

export function getOrCreateLead(sessionId: string): Lead {
  if (!leads.has(sessionId)) {
    const now = Date.now();
    leads.set(sessionId, { sessionId, createdAt: now, updatedAt: now });
  }
  return leads.get(sessionId)!;
}

export function updateLead(sessionId: string, patch: Partial<Lead>): Lead {
  const lead = getOrCreateLead(sessionId);
  Object.assign(lead, patch, { updatedAt: Date.now() });
  return lead;
}

export function getLead(sessionId: string): Lead | undefined {
  return leads.get(sessionId);
}

export function allLeads(): Lead[] {
  return Array.from(leads.values());
}

export function qualificationScore(lead: Lead): number {
  let score = 0;
  if (lead.name) score++;
  if (lead.service) score++;
  if (lead.address) score++;
  if (lead.urgency) score++;
  return score;
}
