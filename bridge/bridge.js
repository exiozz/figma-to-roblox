// Application locale FigmaRoblox (Node 18+, aucune dépendance).
// - Reçoit les designs du plugin Figma, les modèles de l'add-on Blender,
//   et les fichiers déposés dans un dossier surveillé.
// - Les met en ligne sur Roblox via Open Cloud (avec la clé de l'utilisateur).
// - Les sert au plugin Roblox Studio, et affiche un panneau sur http://localhost:7777.
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { exec } = require("child_process");

const PORT = 7777;
const PANEL_ORIGINS = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
// En-tête exigé sur les envois : un site web ne peut pas l'ajouter sans autorisation CORS,
// donc une page ouverte dans le navigateur ne peut pas envoyer de fichiers sur ton compte.
const CLIENT_HEADER = "x-figmaroblox";
const MAX_UPLOAD = 20 * 1024 * 1024; // limite Open Cloud par fichier

// Formats acceptés par l'API Assets d'Open Cloud.
const FORMATS = {
  ".png": { assetType: "Image", contentType: "image/png", kind: "image" },
  ".jpg": { assetType: "Image", contentType: "image/jpeg", kind: "image" },
  ".jpeg": { assetType: "Image", contentType: "image/jpeg", kind: "image" },
  ".bmp": { assetType: "Image", contentType: "image/bmp", kind: "image" },
  ".tga": { assetType: "Image", contentType: "image/tga", kind: "image" },
  ".fbx": { assetType: "Model", contentType: "model/fbx", kind: "model" },
  ".gltf": { assetType: "Model", contentType: "model/gltf+json", kind: "model" },
  ".glb": { assetType: "Model", contentType: "model/gltf-binary", kind: "model" },
  ".rbxm": { assetType: "Model", contentType: "model/x-rbxm", kind: "model" },
  ".rbxmx": { assetType: "Model", contentType: "model/x-rbxm", kind: "model" },
};

// Réglages et données dans %APPDATA%, pour que l'exe marche depuis n'importe quel dossier.
const DATA_DIR = path.join(process.env.APPDATA || os.homedir(), "FigmaRoblox");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const CACHE_FILE = path.join(DATA_DIR, "upload-cache.json");
const ASSETS_FILE = path.join(DATA_DIR, "assets.json");
// Dossier surveillé : tout fichier compatible déposé ici est mis en ligne.
const DROP_DIR = path.join(os.homedir(), "Documents", "FigmaRoblox", "Envoyer vers Roblox");
const SENT_DIR = path.join(os.homedir(), "Documents", "FigmaRoblox", "Envoyés");
for (const dir of [DATA_DIR, DROP_DIR, SENT_DIR]) fs.mkdirSync(dir, { recursive: true });

// Le BOM est retiré : le Bloc-notes et PowerShell en ajoutent un, que JSON.parse refuse.
const readJson = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")) : fallback;
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
const config = readJson(CONFIG_FILE, {});
const cache = readJson(CACHE_FILE, {}); // "Type:sha256" → assetId : un fichier identique n'est jamais renvoyé.
const assets = readJson(ASSETS_FILE, []); // historique des fichiers mis en ligne (pour le plugin Studio)

let latest = null;
let version = 0;
const logLines = [];

function log(line) {
  const entry = `${new Date().toLocaleTimeString()}  ${line}`;
  console.log(entry);
  logLines.push(entry);
  if (logLines.length > 100) logLines.shift();
}

function panelHtml() {
  try {
    const sea = require("node:sea");
    if (sea.isSea()) return sea.getAsset("panel.html", "utf8");
  } catch {}
  return fs.readFileSync(path.join(__dirname, "panel.html"), "utf8");
}

const isConfigured = () => !!(config.apiKey && (config.userId || config.groupId));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireConfigured() {
  if (!isConfigured()) throw new Error("Clé API non configurée : ouvre http://localhost:7777");
}

async function uploadAsset(bytes, format, name, description) {
  if (bytes.length > MAX_UPLOAD) throw new Error(`« ${name} » dépasse 20 Mo (limite de Roblox).`);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const key = `${format.assetType}:${hash}`;
  if (cache[key]) return { assetId: cache[key], fresh: false };

  const creator = config.groupId ? { groupId: String(config.groupId) } : { userId: String(config.userId) };
  const form = new FormData();
  form.append("request", JSON.stringify({
    assetType: format.assetType,
    displayName: name.slice(0, 50) || "Import",
    description,
    creationContext: { creator },
  }));
  form.append("fileContent", new Blob([bytes], { type: format.contentType }), "file");

  const res = await fetch("https://apis.roblox.com/assets/v1/assets", {
    method: "POST",
    headers: { "x-api-key": config.apiKey },
    body: form,
  });
  let op = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Upload refusé (${res.status}) : ${JSON.stringify(op)}`);

  // L'upload est asynchrone côté Roblox : on attend la fin de l'opération.
  for (let i = 0; !op.done; i++) {
    if (i >= 60) throw new Error("Upload trop long, réessaie plus tard.");
    await sleep(1000);
    const poll = await fetch(`https://apis.roblox.com/assets/v1/${op.path}`, { headers: { "x-api-key": config.apiKey } });
    op = await poll.json();
    if (!poll.ok) throw new Error(`Suivi de l'upload impossible : ${JSON.stringify(op)}`);
  }
  if (op.error) throw new Error(`Upload échoué : ${JSON.stringify(op.error)}`);

  const assetId = op.response.assetId;
  cache[key] = assetId;
  writeJson(CACHE_FILE, cache);
  return { assetId, fresh: true };
}

// Met en ligne un fichier (Blender ou dossier) et l'ajoute à la liste lue par Studio.
async function importFile(bytes, fileName, source) {
  requireConfigured();
  const ext = path.extname(fileName).toLowerCase();
  const format = FORMATS[ext];
  if (!format) throw new Error(`Format non pris en charge : ${ext || fileName}`);
  const name = path.basename(fileName, path.extname(fileName));
  const { assetId, fresh } = await uploadAsset(bytes, format, name, `Importé depuis ${source}`);
  const entry = { id: (assets.at(-1)?.id || 0) + 1, kind: format.kind, name, assetId, source, at: Date.now() };
  assets.push(entry);
  if (assets.length > 200) assets.shift();
  writeJson(ASSETS_FILE, assets);
  log(`${source} : « ${fileName} » → ${format.kind === "model" ? "modèle" : "image"} ${assetId}${fresh ? "" : " (déjà en ligne)"}.`);
  return entry;
}

// --- Dossier surveillé ---------------------------------------------------------------
const pending = new Set();

async function processDropFile(fileName) {
  const full = path.join(DROP_DIR, fileName);
  if (pending.has(full) || !FORMATS[path.extname(fileName).toLowerCase()]) return;
  pending.add(full);
  try {
    // On attend que la copie du fichier soit terminée (taille stable).
    let size = -1;
    for (;;) {
      await sleep(700);
      if (!fs.existsSync(full)) return;
      const now = fs.statSync(full).size;
      if (now === size && now > 0) break;
      size = now;
    }
    if (!isConfigured()) {
      log(`Dossier : « ${fileName} » en attente — configure d'abord ta clé API.`);
      return;
    }
    await importFile(fs.readFileSync(full), fileName, "Dossier");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    fs.renameSync(full, path.join(SENT_DIR, `${stamp} ${fileName}`));
  } catch (e) {
    log(`Dossier : « ${fileName} » non envoyé — ${e.message}`);
  } finally {
    pending.delete(full);
  }
}

function scanDropDir() {
  for (const f of fs.readdirSync(DROP_DIR)) processDropFile(f);
}

fs.watch(DROP_DIR, (_event, fileName) => fileName && processDropFile(fileName));

// --- Serveur -------------------------------------------------------------------------
async function testKey() {
  if (!config.apiKey) return { ok: false, message: "Aucune clé enregistrée." };
  const res = await fetch("https://apis.roblox.com/api-keys/v1/introspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: config.apiKey }),
  });
  const info = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: "Clé refusée par Roblox (invalide ou mal copiée)." };
  if (info.enabled === false) return { ok: false, message: "Cette clé est désactivée." };
  if (info.expired) return { ok: false, message: "Cette clé a expiré." };
  const ops = (info.scopes || []).flatMap((s) => s.operations || []);
  if (!ops.includes("asset:write")) {
    return { ok: false, message: "La clé n'a pas la permission Assets → Write. Ajoute-la sur create.roblox.com." };
  }
  if (!config.userId && !config.groupId && info.authorizedUserId) {
    config.userId = String(info.authorizedUserId);
    writeJson(CONFIG_FILE, config);
  }
  scanDropDir(); // des fichiers attendaient peut-être une clé valide
  return { ok: true, message: `Clé valide « ${info.name || "sans nom"} » avec droit d'upload.` };
}

function attachImages(node, ids) {
  if (node.kind === "image") node.image = "rbxassetid://" + ids[node.image];
  for (const c of node.children || []) attachImages(c, ids);
}

async function readRaw(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Fichier trop gros (20 Mo maximum).");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  const raw = await readRaw(req, 64 * 1024 * 1024);
  return raw.length ? JSON.parse(raw.toString("utf8")) : {};
}

function send(res, status, body, extraHeaders) {
  res.writeHead(status, Object.assign({ "Content-Type": "application/json" }, extraHeaders));
  res.end(JSON.stringify(body));
}

// L'iframe du plugin Figma a une origine « null » : seule cette origine reçoit l'autorisation CORS.
const FIGMA_CORS = {
  "Access-Control-Allow-Origin": "null",
  "Access-Control-Allow-Headers": `content-type, ${CLIENT_HEADER}`,
  "Access-Control-Allow-Methods": "POST",
};

const routes = {
  // --- Plugins et add-ons (exigent l'en-tête client pour les envois) ---
  "POST /push": { client: true, cors: FIGMA_CORS, run: async (req) => {
    requireConfigured();
    const { name, tree, images } = await readJsonBody(req);
    const ids = {};
    let uploaded = 0;
    for (const [key, b64] of Object.entries(images)) {
      const r = await uploadAsset(Buffer.from(b64, "base64"), FORMATS[".png"], `${name} ${key}`, "Importé depuis Figma");
      ids[key] = r.assetId;
      if (r.fresh) uploaded++;
    }
    attachImages(tree, ids);
    latest = { version: ++version, name, tree, at: Date.now() };
    log(`Figma : « ${name} » (v${version}) — ${uploaded} nouvelle(s) image(s) en ligne.`);
    return { ok: true, version, uploaded };
  } },
  "POST /upload": { client: true, run: async (req, url) => {
    const fileName = url.searchParams.get("name") || "";
    const source = url.searchParams.get("source") || "Import";
    const bytes = await readRaw(req, MAX_UPLOAD);
    return { ok: true, asset: await importFile(bytes, fileName, source) };
  } },
  "GET /latest": { run: async () => latest || { version: 0 } },
  "GET /assets": { run: async (_req, url) => {
    const after = Number(url.searchParams.get("after") || 0);
    return { assets: assets.filter((a) => a.id > after) };
  } },

  // --- Panneau (même origine uniquement) ---
  "GET /status": { panel: true, run: async () => ({
    configured: isConfigured(),
    keyMasked: config.apiKey ? "••••" + config.apiKey.slice(-4) : null,
    userId: config.userId || null,
    groupId: config.groupId || null,
    cached: Object.keys(cache).length,
    last: latest && { name: latest.name, version: latest.version, at: latest.at },
    recent: assets.slice(-8).reverse(),
    dropDir: DROP_DIR,
    log: logLines,
  }) },
  "POST /config": { panel: true, run: async (req) => {
    const body = await readJsonBody(req);
    if (body.apiKey) config.apiKey = String(body.apiKey).trim();
    if (body.groupId || body.userId) {
      delete config.userId;
      delete config.groupId;
      if (body.groupId) config.groupId = String(body.groupId);
      else config.userId = String(body.userId);
    }
    writeJson(CONFIG_FILE, config);
    log("Réglages enregistrés.");
    return { ok: true };
  } },
  "POST /test-key": { panel: true, run: async () => testKey() },
  "POST /open-folder": { panel: true, run: async () => {
    exec(`explorer "${DROP_DIR}"`);
    return { ok: true };
  } },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const routeKey = `${req.method} ${url.pathname}`;

  if (req.method === "OPTIONS") {
    // Seul l'envoi Figma a besoin d'une pré-requête CORS.
    return url.pathname === "/push" ? send(res, 204, {}, FIGMA_CORS) : send(res, 403, { error: "interdit" });
  }
  if (routeKey === "GET /") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(panelHtml());
  }
  const route = routes[routeKey];
  if (!route) return send(res, 404, { error: "introuvable" });

  const origin = req.headers.origin;
  // Le panneau n'accepte que sa propre page ; les envois exigent l'en-tête client.
  if (route.panel && origin && !PANEL_ORIGINS.includes(origin)) return send(res, 403, { error: "interdit" });
  if (route.client && req.headers[CLIENT_HEADER] !== "1") return send(res, 403, { error: "client inconnu" }, route.cors);

  try {
    send(res, 200, await route.run(req, url), route.cors);
  } catch (e) {
    log("Erreur : " + e.message);
    send(res, 500, { error: e.message }, route.cors);
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log("Déjà lancé : ouverture du panneau.");
    openPanel();
    setTimeout(() => process.exit(0), 500);
  } else throw e;
});

function openPanel() {
  if (process.platform === "win32" && !process.env.NO_BROWSER) exec(`start "" "http://localhost:${PORT}"`);
}

server.listen(PORT, "127.0.0.1", () => {
  log(`Prêt sur http://localhost:${PORT} — garde cette fenêtre ouverte.`);
  log(`Dossier surveillé : ${DROP_DIR}`);
  if (!isConfigured()) log("Ajoute ta clé API dans le panneau pour commencer.");
  else scanDropDir();
  openPanel();
});
