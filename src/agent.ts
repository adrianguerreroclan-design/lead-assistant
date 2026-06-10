import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { ANTHROPIC_API_KEY } from "./config";
import { buildSystemPrompt } from "./systemPrompt";
import { TOOLS } from "./tools";
import { getOrCreateSession, touch } from "./session";
import { updateLead, getOrCreateLead } from "./leadStore";
import { getAvailableSlots, createCalendarEvent } from "./calendar";
import { sendConfirmationEmail, sendInternalNotification } from "./mailer";

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function handleToolCall(
  sessionId: string,
  toolName: string,
  toolInput: Record<string, any>
): Promise<string> {
  if (toolName === "save_lead_info") {
    const lead = updateLead(sessionId, {
      name: toolInput.name,
      service: toolInput.service,
      address: toolInput.address,
      urgency: toolInput.urgency,
      phone: toolInput.phone,
      email: toolInput.email,
      notes: toolInput.notes,
    });

    await sendInternalNotification({
      customerName: lead.name!,
      service: lead.service!,
      address: lead.address!,
      urgency: lead.urgency!,
      sessionId,
    }).catch(() => {});

    return JSON.stringify({ ok: true, message: "Lead information saved." });
  }

  if (toolName === "propose_booking") {
    const slots = await getAvailableSlots(toolInput.urgency ?? "medium");
    if (slots.length === 0) {
      return JSON.stringify({ ok: false, message: "No available slots found. Ask customer to call directly." });
    }
    const lead = getOrCreateLead(sessionId);
    updateLead(sessionId, { bookingProposed: true });
    return JSON.stringify({ ok: true, slots: slots.map((s) => ({ label: s.label, iso: s.start })) });
  }

  return JSON.stringify({ error: "Unknown tool" });
}

export async function runAgent(sessionId: string, userMessage: string): Promise<string> {
  const session = getOrCreateSession(sessionId);
  touch(sessionId);

  session.messages.push({ role: "user", content: userMessage });

  let finalText = "";

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages: session.messages as MessageParam[],
    });

    const assistantContent = response.content;
    session.messages.push({ role: "assistant", content: assistantContent });

    if (response.stop_reason !== "tool_use") {
      finalText = assistantContent
        .filter((b) => b.type === "text")
        .map((b) => (b as any).text)
        .join("");
      break;
    }

    const toolResults: any[] = [];
    for (const block of assistantContent) {
      if (block.type !== "tool_use") continue;
      const result = await handleToolCall(sessionId, block.name, block.input as Record<string, any>);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    session.messages.push({ role: "user", content: toolResults });
  }

  return finalText;
}

export async function confirmBooking(
  sessionId: string,
  slotIso: string,
  slotLabel: string
): Promise<string> {
  const lead = getOrCreateLead(sessionId);
  if (!lead.name || !lead.service || !lead.address) {
    return "Missing lead information. Cannot confirm booking.";
  }

  const eventId = await createCalendarEvent(sessionId, lead.name, lead.service, lead.address, {
    start: slotIso,
    end: new Date(new Date(slotIso).getTime() + 2 * 60 * 60 * 1000).toISOString(),
    label: slotLabel,
  });

  updateLead(sessionId, { bookedSlot: slotLabel, calendarEventId: eventId ?? undefined });

  if (lead.email) {
    await sendConfirmationEmail({
      to: lead.email,
      customerName: lead.name,
      service: lead.service,
      address: lead.address,
      slot: slotLabel,
    }).catch(() => {});
  }

  await sendInternalNotification({
    customerName: lead.name,
    service: lead.service,
    address: lead.address,
    urgency: lead.urgency ?? "medium",
    slot: slotLabel,
    sessionId,
  }).catch(() => {});

  return `Booked! Your ${lead.service} appointment is confirmed for ${slotLabel}. ${lead.email ? "A confirmation email is on its way." : ""}`;
}
