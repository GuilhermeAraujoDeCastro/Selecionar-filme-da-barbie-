// Servidor estatico simples pra pre-visualizar o site localmente (sem a
// function /api, que precisa da Vercel CLI) e pra servir o app durante os
// testes E2E do Playwright (veja playwright.config.js). Nao faz parte do
// build da Vercel.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const PORT = Number(process.env.PORT) || 5173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

createServer(async (request, response) => {
  let filePath;
  try {
    const urlPath = request.url === "/" ? "/index.html" : request.url.split("?")[0];
    filePath = join(ROOT, decodeURIComponent(urlPath));
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  // So serve arquivo dentro do projeto (bloqueia "../../.env").
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Servidor estatico em http://localhost:${PORT}`));
