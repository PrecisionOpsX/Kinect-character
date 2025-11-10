import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = 3002;
const OUTPUT_DIR = path.join(__dirname, "output/kinect");

// Middleware
app.use(cors());
app.use(express.json());

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Created output directory: ${OUTPUT_DIR}`);
}

// WebSocket connection handler
io.on("connection", (socket) => {
  console.log(
    `\n[${new Date().toLocaleTimeString()}] Client connected: ${socket.id}`
  );

  let streamingInterval = null;
  let isStreamingLoop = false;

  // Helper to start continuous loop
  const startStreamingLoop = () => {
    if (isStreamingLoop) {
      socket.emit("stream-status", { status: "already-streaming" });
      return;
    }
    isStreamingLoop = true;
    socket.emit("stream-status", { status: "started" });

    const loop = async () => {
      if (!isStreamingLoop) return;
      try {
        const files = fs
          .readdirSync(OUTPUT_DIR)
          .filter((f) => f.endsWith(".json"))
          .map((f) => ({
            name: f,
            path: path.join(OUTPUT_DIR, f),
            time: fs.statSync(path.join(OUTPUT_DIR, f)).mtime,
          }))
          .sort((a, b) => {
            const numA = parseInt(a.name.match(/\d+/)[0], 10);
            const numB = parseInt(b.name.match(/\d+/)[0], 10);
            return numA - numB;
          });

        if (files.length === 0) {
          socket.emit("file-data", {
            filename: null,
            index: 0,
            total: 0,
            timestamp: new Date().toISOString(),
            data: null,
            message: "No files found; retrying",
          });
          // Retry after short delay
          setTimeout(loop, 1000);
          return;
        }

        for (let i = 0; i < files.length && isStreamingLoop; i++) {
          const file = files[i];
          try {
            const fileContent = fs.readFileSync(file.path, "utf-8");
            const jsonData = JSON.parse(fileContent);
            console.log(`Streamed file: ${file.name}`);

            const outputData = {
              ...jsonData,
            };
            if (!jsonData.bodies) {
              outputData.bodies = [
                {
                  bodyIndex: 0,
                  tracked: true,
                  trackingId: "72057594037929407",
                  leftHandState: 0,
                  rightHandState: 2,
                  joints: jsonData,
                },
              ];
            }

            socket.emit("file-data", {
              filename: file.name,
              index: i + 1,
              total: files.length,
              timestamp: file.time.toISOString(),
              data: outputData,
              cycleComplete: false,
            });

            await new Promise((r) => setTimeout(r, 75));
          } catch (err) {
            socket.emit("file-error", {
              filename: file.name,
              error: err.message,
            });
          }
        }

        if (isStreamingLoop) {
          socket.emit("stream-cycle", { timestamp: new Date().toISOString() });
          setTimeout(loop, 250); // Small pause before next cycle
        }
      } catch (err) {
        socket.emit("stream-error", { error: err.message });
        setTimeout(loop, 1000); // Retry after error
      }
    };

    loop();
  };

  // Stream all files on demand
  socket.on("stream-files", () => {
    startStreamingLoop();
  });

  socket.on("stop-stream", () => {
    isStreamingLoop = false;
    socket.emit("stream-status", { status: "stopped" });
  });

  // Watch for new files and stream them in real-time
  socket.on("watch-files", () => {
    console.log(
      `[${new Date().toLocaleTimeString()}] Client ${
        socket.id
      } watching for new files`
    );

    const watcher = fs.watch(OUTPUT_DIR, (eventType, filename) => {
      if (filename && filename.endsWith(".json") && eventType === "change") {
        try {
          // Small delay to ensure file is fully written
          setTimeout(() => {
            const filepath = path.join(OUTPUT_DIR, filename);
            if (fs.existsSync(filepath)) {
              const fileContent = fs.readFileSync(filepath, "utf-8");
              const jsonData = JSON.parse(fileContent);
              const stats = fs.statSync(filepath);

              socket.emit("new-file", {
                filename: filename,
                timestamp: stats.mtime.toISOString(),
                data: jsonData,
              });

              console.log(
                `[${new Date().toLocaleTimeString()}] Streamed new file: ${filename}`
              );
            }
          }, 100);
        } catch (error) {
          console.error(
            `Error processing new file ${filename}:`,
            error.message
          );
        }
      }
    });

    // Store watcher reference for cleanup
    socket.watcher = watcher;
  });

  // Get file list
  socket.on("list-files", () => {
    try {
      const files = fs
        .readdirSync(OUTPUT_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          const stats = fs.statSync(path.join(OUTPUT_DIR, f));
          return {
            filename: f,
            size: stats.size,
            timestamp: stats.mtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      socket.emit("file-list", {
        count: files.length,
        files: files,
      });

      console.log(
        `[${new Date().toLocaleTimeString()}] Listed ${
          files.length
        } files for client ${socket.id}`
      );
    } catch (error) {
      console.error("List files error:", error);
      socket.emit("list-error", {
        error: error.message,
      });
    }
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    isStreamingLoop = false;
    if (socket.watcher) {
      socket.watcher.close();
    }
    console.log(
      `[${new Date().toLocaleTimeString()}] Client disconnected: ${socket.id}`
    );
  });

  // Error handler
  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// REST endpoint for health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    filesInOutput: fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".json"))
      .length,
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  Socket Stream Server Running          ║
╠════════════════════════════════════════╣
║  URL: http://localhost:${PORT}         ║
║  WebSocket: ws://localhost:${PORT}     ║
║                                        ║
║  Events:                               ║
║  - stream-files: Stream all files      ║
║  - watch-files: Watch for new files    ║
║  - list-files: Get file list           ║
║                                        ║
║  Output: ${OUTPUT_DIR}
╚════════════════════════════════════════╝
  `);
});
