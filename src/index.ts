import "./config"; // validates env vars on startup
import { startServer } from "./server";
import { startFollowUpEngine } from "./followup";

startServer();
startFollowUpEngine();
