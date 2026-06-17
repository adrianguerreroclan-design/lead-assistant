import rateLimit from "express-rate-limit";
import express from "express";
import path from "path";
import { randomUUID } from "crypto";
import { runAgent, confirmBooking } from "./agent";
import { getOrCreateSession, drainPending } from "./session";
import { getLead } from "./leadStore";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a few minutes and try again." },
});

const bookLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Booking limit reached. Please try again later or call us directly." },
});

// POST /api/chat — send a user message, get assistant reply
app.post("/api/chat", chatLimiter, async (req, res) => {
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
app.post("/api/book", bookLimiter, async (req, res) => {
  const { sessionId, slotIso, slotLabel } = req.body as {
    sessionId?: string;
    slotIso?: string;
    slotLabel?: string;
  };
  if (!sessionId || !slotIso || !slotLabel) {
    return res.status(400).json({ error: "sessionId, slotIso, and slotLabel are required" });
  }
  try {
    const { message, calendarDebug } = await confirmBooking(sessionId, slotIso, slotLabel);
    const lead = getLead(sessionId);
    res.json({ message, lead, ...(calendarDebug ? { calendarDebug } : {}) });
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

app.get("/health", (_req, res) => res.json({ ok: true }));

export function startServer(): void {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Lead assistant running on 0.0.0.0:${port}`);
  });
}

startServer();
