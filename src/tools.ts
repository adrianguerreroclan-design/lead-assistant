import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const TOOLS: Tool[] = [
  {
    name: "save_lead_info",
    description:
      "Save or update the customer's lead information. Call it as soon as you have the four required fields (name, service, address, urgency). Can be called a second time with just the email field once the customer provides it — existing fields are preserved.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Customer's full name" },
        service: { type: "string", description: "Service type requested" },
        address: { type: "string", description: "Service address" },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high", "emergency"],
          description: "Urgency level",
        },
        phone: { type: "string", description: "Customer phone number (optional)" },
        email: { type: "string", description: "Customer email address (optional)" },
        notes: { type: "string", description: "Any additional notes" },
      },
      required: ["name", "service", "address", "urgency"],
    },
  },
  {
    name: "propose_booking",
    description:
      "Fetch available appointment slots and present them to the customer. Call after save_lead_info.",
    input_schema: {
      type: "object" as const,
      properties: {
        service: { type: "string", description: "Service type for the appointment" },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high", "emergency"],
          description: "Urgency level — affects how soon slots are offered",
        },
        preferredDate: {
          type: "string",
          description: "ISO date string the customer prefers (optional)",
        },
      },
      required: ["service", "urgency"],
    },
  },
  {
    name: "confirm_booking",
    description:
      "Write the appointment to Google Calendar and send confirmation emails. Call this ONLY after the customer has explicitly chosen a specific slot from the list. Returns ok: true on success, ok: false with a reason on failure. Only tell the customer the booking is confirmed if ok is true.",
    input_schema: {
      type: "object" as const,
      properties: {
        slotIso: {
          type: "string",
          description: "ISO datetime string of the chosen slot start time",
        },
        slotLabel: {
          type: "string",
          description: "Human-readable label for the slot, e.g. 'Fri, Jun 13, 9:00 AM'",
        },
      },
      required: ["slotIso", "slotLabel"],
    },
  },
];
