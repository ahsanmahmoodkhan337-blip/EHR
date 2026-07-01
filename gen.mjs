// Generate clean index.html for static SPA
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const clientDir = "dist/client";
const assets = readdirSync(join(clientDir, "assets"));
const cssFiles = assets.filter(f => f.endsWith(".css"));
const jsFiles = assets.filter(f => f.endsWith(".js") && !f.includes("start-"));

// Get the main JS chunks (index-*.js)
const mainChunks = jsFiles.filter(f => f.startsWith("index-"));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Healthcare Hustlers — EHR Simulation Portal</title>
  <link rel="icon" type="image/png" href="/favicon.png"/>
  ${cssFiles.map(f => `<link rel="stylesheet" href="/assets/${f}"/>`).join("\n  ")}
  <script>window.__SPA_MODE__ = true;</script>
</head>
<body>
  <div id="root"></div>
  ${mainChunks.map(f => `<script type="module" async="" src="/assets/${f}"></script>`).join("\n  ")}
</body>
</html>`;

writeFileSync(join(clientDir, "index.html"), html);
console.log("OK", html.length);