import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";

const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "3201", 10);
const root = normalize(fileURLToPath(new URL("../", import.meta.url)));
const uploadRoot = normalize(process.env.MEQ3D_UPLOAD_DIR || join(root, "..", "work", "meq3d-uploads"));
const maxUploadBytes = 25 * 1024 * 1024;
const allowedOrigins = new Set([
  "https://meq3d.meqforge.com",
  `http://${host}:${port}`,
  `http://localhost:${port}`,
]);
const uploadWindows = new Map();

mkdirSync(uploadRoot, { recursive: true });

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

function decodeMetadata(value) {
  if (!value || value.length > 8192) throw new Error("Metadatos ausentes o demasiado extensos.");
  const metadata = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  const project = String(metadata.project || "").trim();
  const contact = String(metadata.contact || "").trim();
  const details = String(metadata.details || "").trim();
  const license = String(metadata.license || "").trim();
  const originalName = String(metadata.originalName || "").trim();
  const allowedLicenses = new Set(["own", "authorized", "commercial", "open-commercial"]);

  if (project.length < 2 || project.length > 100) throw new Error("Nombre de proyecto inválido.");
  if (contact.length < 3 || contact.length > 160) throw new Error("Contacto inválido.");
  if (!details || details.length > 1500) throw new Error("Descripción inválida.");
  if (!allowedLicenses.has(license)) throw new Error("Licencia inválida.");
  if (!originalName.toLowerCase().endsWith(".stl") || originalName.length > 180) throw new Error("El archivo debe ser STL.");
  if (metadata.accepted !== true) throw new Error("Debes aceptar los términos y declarar la licencia.");

  return { project, contact, details, license, originalName: originalName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_") };
}

function isStl(buffer) {
  if (buffer.length < 84) return false;
  const asciiHead = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("ascii").trimStart().toLowerCase();
  if (asciiHead.startsWith("solid") && asciiHead.includes("facet")) return true;
  const triangles = buffer.readUInt32LE(80);
  return 84 + triangles * 50 === buffer.length;
}

function rateLimited(req) {
  const key = String(req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "local");
  const now = Date.now();
  const recent = (uploadWindows.get(key) || []).filter((timestamp) => now - timestamp < 60 * 60 * 1000);
  if (recent.length >= 10) return true;
  recent.push(now);
  uploadWindows.set(key, recent);
  return false;
}

function handleUpload(req, res) {
  const origin = String(req.headers.origin || "");
  if (!allowedOrigins.has(origin)) {
    sendJson(res, 403, { error: "Origen no permitido." });
    return;
  }
  if (rateLimited(req)) {
    sendJson(res, 429, { error: "Límite temporal de archivos alcanzado. Intenta más tarde." });
    return;
  }

  const declaredLength = Number.parseInt(String(req.headers["content-length"] || "0"), 10);
  if (!declaredLength || declaredLength > maxUploadBytes) {
    sendJson(res, 413, { error: "El STL debe pesar como máximo 25 MB." });
    return;
  }

  let metadata;
  try {
    metadata = decodeMetadata(req.headers["x-meq3d-metadata"]);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Metadatos inválidos." });
    return;
  }

  const chunks = [];
  let size = 0;
  let finished = false;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > maxUploadBytes) {
      finished = true;
      sendJson(res, 413, { error: "El STL debe pesar como máximo 25 MB." });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    if (finished) return;
    const file = Buffer.concat(chunks);
    if (!isStl(file)) {
      sendJson(res, 400, { error: "El contenido no parece ser un STL ASCII o binario válido." });
      return;
    }

    const id = `M3D-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const basePath = join(uploadRoot, id);
    const receivedAt = new Date();
    const retentionUntil = new Date(receivedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    const sha256 = createHash("sha256").update(file).digest("hex");
    writeFileSync(`${basePath}.stl`, file, { flag: "wx" });
    writeFileSync(`${basePath}.json`, JSON.stringify({
      id,
      ...metadata,
      size: file.length,
      sha256,
      receivedAt: receivedAt.toISOString(),
      retentionUntil: retentionUntil.toISOString(),
    }, null, 2), { flag: "wx" });
    sendJson(res, 201, { id, fileName: metadata.originalName, size: file.length });
  });
}

createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "POST" && url.pathname === "/api/uploads") {
    handleUpload(req, res);
    return;
  }

  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    send(res, 400, "Bad request");
    return;
  }

  if (pathname === "/healthz") {
    send(res, 200, "ok", { "Cache-Control": "no-store" });
    return;
  }

  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = normalize(join(root, requested));
  const relativePath = relative(root, filePath);

  if (
    relativePath.startsWith("..") ||
    relativePath.includes(":") ||
    relativePath.startsWith(".git") ||
    relativePath.startsWith("deploy") ||
    relativePath.startsWith(".local") ||
    !existsSync(filePath)
  ) {
    send(res, 404, "Not found");
    return;
  }

  const stats = statSync(filePath);
  if (!stats.isFile()) {
    send(res, 404, "Not found");
    return;
  }

  const extension = extname(filePath).toLowerCase();
  const cacheControl = [".html", ".css", ".js"].includes(extension) ? "no-cache" : "public, max-age=3600";
  res.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Content-Length": stats.size,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  createReadStream(filePath).pipe(res);
}).listen(port, host, () => {
  console.log(`Meq3D listening on http://${host}:${port}`);
});
