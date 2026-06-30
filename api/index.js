// Vercel serverless function — wraps TanStack Start SSR handler
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");

// Import the TanStack Start SSR handler
let handler;
try {
  const server = await import(join(root, "dist/server/server.js"));
  handler = server.default || server;
} catch (e) {
  console.error("Failed to load SSR handler:", e.message);
}

export default async function (req, res) {
  // Handle static files from dist/client
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filePath = join(root, "dist/client", url.pathname === "/" ? "index.html" : url.pathname);
    const content = readFileSync(filePath);
    const ext = filePath.split(".").pop();
    const mime = {
      js: "application/javascript", css: "text/css", html: "text/html",
      png: "image/png", svg: "image/svg+xml", ico: "image/x-icon",
    };
    res.setHeader("Content-Type", mime[ext] || "text/plain");
    return res.end(content);
  } catch {}

  // SSR fallback
  if (!handler) return res.status(500).end("Server handler not loaded");
  
  try {
    const response = await handler.fetch(req);
    res.status(response.status);
    response.headers.forEach((v, k) => res.setHeader(k, v));
    const body = await response.text();
    return res.end(body);
  } catch (e) {
    return res.status(500).end("SSR Error: " + e.message);
  }
}