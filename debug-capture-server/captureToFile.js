import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const OUTPUT_DIR = path.join(__dirname, "output");

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Created output directory: ${OUTPUT_DIR}`);
}

// POST endpoint to capture and save JSON
app.post("/capture", (req, res) => {
  try {
    const jsonData = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `capture_${timestamp}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);

    // Write JSON to file
    fs.writeFileSync(filepath, JSON.stringify(jsonData, null, 2));

    console.log(`✓ Saved: ${filename}`);

    res.json({
      success: true,
      message: "Data captured successfully",
      filename: filename,
      filepath: filepath,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET endpoint to list captured files
app.get("/captures", (req, res) => {
  try {
    const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".json"));
    const captures = files.map((f) => ({
      filename: f,
      path: `/captures/${f}`,
    }));

    res.json({
      success: true,
      count: captures.length,
      files: captures,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET endpoint to retrieve a specific capture file
app.get("/captures/:filename", (req, res) => {
  try {
    const filepath = path.join(OUTPUT_DIR, req.params.filename);

    // Security: prevent directory traversal
    if (!filepath.startsWith(OUTPUT_DIR)) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: "File not found",
      });
    }

    const data = fs.readFileSync(filepath, "utf-8");
    res.json(JSON.parse(data));
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  Capture Server Running                ║
╠════════════════════════════════════════╣
║  URL: http://localhost:${PORT}         ║
║  POST /capture - Save JSON data        ║
║  GET  /captures - List all files       ║
║  GET  /captures/:filename - Get file   ║
║  GET  /health - Health check           ║
║  Output: ${OUTPUT_DIR}                 ║
╚════════════════════════════════════════╝
  `);
});
