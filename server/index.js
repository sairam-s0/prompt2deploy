import "./load-env.js";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { generateProjectBundle, getAiConfigStatus } from "./ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "..", "dist");
const app = express();
const port = Number(process.env.PORT || 4000);

app.use(express.json({ limit: "1mb" }));

app.get("/api/status", (_req, res) => {
  return res.status(200).json(getAiConfigStatus());
});

app.post("/api/generate", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";

  if (!prompt) {
    return res.status(400).json({ message: "A prompt is required." });
  }

  try {
    const project = await generateProjectBundle(prompt);
    return res.status(200).json(project);
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    return res.status(statusCode).json({
      message: error.message || "Unable to generate a project right now.",
      details: error.details || null,
    });
  }
});

app.use(express.static(distPath));

app.get("*", async (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  try {
    await fs.access(path.join(distPath, "index.html"));
    return res.sendFile(path.join(distPath, "index.html"));
  } catch {
    return res
      .status(404)
      .send("Frontend not built yet. Run `npm run build` first.");
  }
});

app.listen(port, () => {
  console.log(`prompt2deploy backend running on http://localhost:${port}`);
});
