import express from "express";
import path from "path";
import { randomUUID } from "crypto";
import { PORT } from "./config";
import { runAgent, confirmBooking } from "./agent";
import { getOrCreateSession, drainPending } from "./session";
import { getLead, allLeads } from "./leadStore";

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

// POST /api/chat — send a user message, get assistant reply
app.post("/api/chat", async (req, res) => {
  const { sessionId, message } = req.body as { sessionId?: string; message?: string };
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }
  const sid = sessionId || randomUUID();
  try {
    const reply = await runAgent(sid, message);
    const lead = getLead(sid);
    res.json({ sessionId: sid, reply, lead });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/book — confirm a booking slot
app.post("/api/book", async (req, res) => {
  const { sessionId, slotIso, slotLabel } = req.body as {
    sessionId?: string;
    slotIso?: string;
    slotLabel?: string;
  };
  if (!sessionId || !slotIso || !slotLabel) {
    return res.status(400).json({ error: "sessionId, slotIso, and slotLabel are required" });
  }
  try {
    const message = await confirmBooking(sessionId, slotIso, slotLabel);
    const lead = getLead(sessionId);
    res.json({ message, lead });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/session/:id — poll for pending messages + lead state
app.get("/api/session/:id", (req, res) => {
  const { id } = req.params;
  const session = getOrCreateSession(id);
  const pending = drainPending(id);
  const lead = getLead(id);
  res.json({ sessionId: id, pending, lead });
});

export function startServer(): void {
  app.listen(PORT, () => {
    console.log(`Lead assistant running at http://localhost:${PORT}`);
  });
}
