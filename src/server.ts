import rateLimit from "express-rate-limit";
import express from "express";
import path from "path";
import { randomUUID } from "crypto";
import { runAgent, confirmBooking } from "./agent";
import { getOrCreateSession, drainPending } from "./session";
import { getLead } from "./leadStore";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(process.cwd(), "public")));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validStr(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

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
  const { sessionId, message } = req.body as { sessionId?: unknown; message?: unknown };
  if (sessionId !== undefined && !UUID_RE.test(String(sessionId))) {
    return res.status(400).json({ error: "Invalid request." });
  }
  if (!validStr(message, 2000)) {
    return res.status(400).json({ error: "message must be a non-empty string under 2000 characters." });
  }
  const sid = (typeof sessionId === "string" ? sessionId : null) || randomUUID();
  try {
    const reply = await runAgent(sid, message);
    const lead = getLead(sid);
    res.json({ sessionId: sid, reply, lead });
  } catch (err: any) {
    console.error("[/api/chat]", err);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
});

// POST /api/book — confirm a booking slot
app.post("/api/book", bookLimiter, async (req, res) => {
  const { sessionId, slotIso, slotLabel } = req.body as {
    sessionId?: unknown;
    slotIso?: unknown;
    slotLabel?: unknown;
  };
  if (!validStr(sessionId, 36) || !UUID_RE.test(sessionId)) {
    return res.status(400).json({ error: "Invalid request." });
  }
  if (!validStr(slotIso, 50) || isNaN(Date.parse(slotIso))) {
    return res.status(400).json({ error: "Invalid request." });
  }
  if (!validStr(slotLabel, 100)) {
    return res.status(400).json({ error: "Invalid request." });
  }
  try {
    const { message, calendarDebug } = await confirmBooking(sessionId, slotIso, slotLabel);
    if (calendarDebug) console.error("[/api/book] calendar error:", calendarDebug);
    const lead = getLead(sessionId);
    res.json({ message, lead });
  } catch (err: any) {
    console.error("[/api/book]", err);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
});

// GET /api/session/:id — poll for pending messages + lead state
app.get("/api/session/:id", (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ error: "Invalid session ID." });
  }
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
