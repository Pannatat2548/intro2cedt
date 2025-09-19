import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import chatRoutes from "./routes/chat.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend/public directory
app.use(express.static(path.join(__dirname, "../frontend/public")));

// API routes
app.use("/api/chat", chatRoutes);

// Serve the main HTML file for any non-API routes (SPA fallback)
app.get("*", (req, res) => {
  // Skip API routes
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API route not found" });
  }
  res.sendFile(path.join(__dirname, "../frontend/public/index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Global error handlers
process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! 💥", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! 💥", err);
  server.close(() => process.exit(1));
});

const PORT = process.env.PORT || 3222;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend Server ready at http://localhost:${PORT}`);
  console.log(`📱 Frontend available at http://localhost:${PORT}`);
  console.log(`🤖 API available at http://localhost:${PORT}/api/chat`);
});

export default app;