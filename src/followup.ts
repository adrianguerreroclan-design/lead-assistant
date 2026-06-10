import { allSessions, getSession, pushPending } from "./session";
import { getLead, qualificationScore } from "./leadStore";
import { runAgent } from "./agent";
import business from "./business.json";

const IDLE_MS = 30_000;
const MAX_FOLLOWUPS = 3;

const FOLLOWUP_MESSAGES = [
  `Just checking in! I'd love to help get your ${business.name} service scheduled. What's the best way to reach you?`,
  `Still here if you need us! Do you have any questions about our services or availability?`,
  `Last check-in from me — feel free to restart the chat anytime or call us at ${business.phone}.`,
];

export function startFollowUpEngine(): void {
  setInterval(async () => {
    const now = Date.now();
    for (const session of allSessions()) {
      if (session.followUpCount >= MAX_FOLLOWUPS) continue;
      if (now - session.lastActivity < IDLE_MS) continue;

      const lead = getLead(session.id);
      if (lead?.bookedSlot) continue;
      if (qualificationScore(lead ?? { sessionId: session.id, createdAt: 0, updatedAt: 0 }) === 4) continue;

      const msg = FOLLOWUP_MESSAGES[session.followUpCount] ?? FOLLOWUP_MESSAGES[MAX_FOLLOWUPS - 1];
      session.followUpCount++;
      session.lastActivity = now;

      try {
        const reply = await runAgent(session.id, `[SYSTEM FOLLOW-UP ${session.followUpCount}]: ${msg}`);
        pushPending(session.id, reply);
      } catch {
        pushPending(session.id, msg);
      }
    }
  }, IDLE_MS);
}
