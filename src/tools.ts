import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const TOOLS: Tool[] = [
  {
    name: "save_lead_info",
    description:
      "Save or update the customer's lead information once you have collected it. Call this as soon as you have all four required fields.",
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
];
