/**
 * Task Manager — Node.js backend server.
 * Replaces the Tauri Rust backend with Express + WebSocket.
 *
 * Provides:
 * - REST API for task CRUD, sessions, specs, discovery, projects, settings
 * - WebSocket for real-time file watcher events
 */
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import tasksRouter from "./routes/tasks.js";
import sessionsRouter from "./routes/sessions.js";
import specsRouter from "./routes/specs.js";
import { createDiscoveryRouter } from "./routes/discovery.js";
import projectsRouter from "./routes/projects.js";
import settingsRouter from "./routes/settings.js";
import { initWatcher, handleWatcherMessage, stopAllWatchers, } from "./watcher.js";
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const app = express();
app.use(express.json());
// --- WebSocket setup ---
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
/** Broadcast a message to all connected WebSocket clients. */
const broadcast = (event, payload) => {
    const message = JSON.stringify({ event, payload });
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
};
// Initialize the file watcher with the broadcast function
initWatcher(broadcast);
wss.on("connection", (ws) => {
    ws.on("message", (data) => {
        try {
            const msg = JSON.parse(data.toString());
            handleWatcherMessage(msg.event, msg.payload ?? {});
        }
        catch {
            // Ignore malformed messages
        }
    });
});
// --- REST API routes ---
app.use("/api/tasks", tasksRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/specs", specsRouter);
app.use("/api/discovery", createDiscoveryRouter(broadcast));
app.use("/api/projects", projectsRouter);
app.use("/api/settings", settingsRouter);
// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
});
// --- Start server ---
server.listen(PORT, () => {
    console.log(`Task Manager server running on http://localhost:${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});
// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await stopAllWatchers();
    wss.close();
    server.close();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await stopAllWatchers();
    wss.close();
    server.close();
    process.exit(0);
});
//# sourceMappingURL=index.js.map