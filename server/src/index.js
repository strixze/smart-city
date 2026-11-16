import http from "http";
import server from "./server.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import connectDB from "./db/dbConfig.js";
import { initSocketIO } from "./services/socket.service.js";
import { initWebPush } from "./services/webpush.service.js";

// Ensure .env is loaded reliably regardless of working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config({ path: "./.env" });
}

const port = process.env.PORT || 3000;

connectDB()
  .then(async () => {
    // Validate and log Web Push VAPID setup at server boot
    initWebPush();

    // Create HTTP server from Express app (required for Socket.IO)
    const httpServer = http.createServer(server);

    // Initialize Socket.IO on the HTTP server
    initSocketIO(httpServer);

    httpServer.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server due to DB connection error:", err.message);
    process.exit(1);
  });
