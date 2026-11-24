// Pont local Figma → Roblox Studio (Node 18+, aucune dépendance).
// Reçoit le design du plugin Figma, met les PNG en ligne via Roblox Open Cloud,
// le sert au plugin Studio, et affiche un panneau de réglages sur http://localhost:7777.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { exec } = require("child_process");

const PORT = 7777;
const PANEL_ORIGINS = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];

// Réglages et cache dans %APPDATA%, pour que l'exe marche depuis n'importe quel dossier.
const DATA_DIR = path.join(process.env.APPDATA || require("os").homedir(), "FigmaRoblox");
fs.mkdirSync(DATA_DIR, { recursive: true });
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const CACHE_FILE = path.join(DATA_DIR, "upload-cache.json");

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {});
const config = readJson(CONFIG_FILE);
const cache = readJson(CACHE_FILE); // sha256 du PNG → assetId : une image n'est jamais renvoyée deux fois.

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

async function uploadPng(base64, name) {
  const bytes = Buffer.from(base64, "base64");
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (cache[hash]) return { assetId: cache[hash], fresh: false };

  const creator = config.groupId ? { groupId: String(config.groupId) } : { userId: String(config.userId) };
  const form = new FormData();
  form.append("request", JSON.stringify({
    assetType: "Decal",
    displayName: name.slice(0, 50) || "Figma UI",
    description: "Importé depuis Figma",
    creationContext: { creator },
  }));
  form.append("fileContent", new Blob([bytes], { type: "image/png" }), "image.png");

  const res = await fetch("https://apis.roblox.com/assets/v1/assets", {
    method: "POST",
    headers: { "x-api-key": config.apiKey },
    body: form,
  });
  let op = await res.json();
  if (!res.ok) throw new Error(`Upload refusé (${res.status}) : ${JSON.stringify(op)}`);

  // L'upload est asynchrone côté Roblox : on attend la fin de l'opération.
  for (let i = 0; !op.done; i++) {
    if (i >= 30) throw new Error("Upload trop long, réessaie plus tard.");
    await sleep(1000);
    const poll = await fetch(`https://apis.roblox.com/assets/v1/${op.path}`, { headers: { "x-api-key": config.apiKey } });
    op = await poll.json();
    if (!poll.ok) throw new Error(`Suivi de l'upload impossible : ${JSON.stringify(op)}`);
  }
  if (op.error) throw new Error(`Upload échoué : ${JSON.stringify(op.error)}`);

  const assetId = op.response.assetId;
  cache[hash] = assetId;
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  return { assetId, fresh: true };
}

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
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  }
  return { ok: true, message: `Clé valide « ${info.name || "sans nom"} » avec droit d'upload.` };
}

function attachImages(node, ids) {
  if (node.kind === "image") node.image = "rbxassetid://" + ids[node.image];
  for (const c of node.children || []) attachImages(c, ids);
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function send(res, status, body, cors) {
  const headers = { "Content-Type": "application/json" };
  if (cors) Object.assign(headers, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" });
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

const routes = {
  // --- Utilisées par les plugins (CORS ouvert : l'iframe Figma a une origine « null ») ---
  "GET /latest": async () => latest || { version: 0 },
  "POST /push": async (req) => {
    if (!isConfigured()) throw new Error("Clé API non configurée : ouvre http://localhost:7777");
    const { name, tree, images } = await readBody(req);
    const ids = {};
    let uploaded = 0;
    for (const [key, b64] of Object.entries(images)) {
      const r = await uploadPng(b64, `${name} ${key}`);
      ids[key] = r.assetId;
      if (r.fresh) uploaded++;
    }
    attachImages(tree, ids);
    latest = { version: ++version, name, tree, at: Date.now() };
    log(`Reçu « ${name} » (v${version}) — ${uploaded} nouvelle(s) image(s) en ligne.`);
    return { ok: true, version, uploaded };
  },

  // --- Réservées au panneau (même origine uniquement) ---
  "GET /status": async () => ({
    configured: isConfigured(),
    keyMasked: config.apiKey ? "••••" + config.apiKey.slice(-4) : null,
    userId: config.userId || null,
    groupId: config.groupId || null,
    cached: Object.keys(cache).length,
    last: latest && { name: latest.name, version: latest.version, at: latest.at },
    log: logLines,
  }),
  "POST /config": async (req) => {
    const body = await readBody(req);
    if (body.apiKey) config.apiKey = String(body.apiKey).trim();
    if (body.groupId || body.userId) {
      delete config.userId;
      delete config.groupId;
      if (body.groupId) config.groupId = String(body.groupId);
      else config.userId = String(body.userId);
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    log("Réglages enregistrés.");
    return { ok: true };
  },
  "POST /test-key": async () => testKey(),
};
const PLUGIN_ROUTES = new Set(["GET /latest", "POST /push"]);

const server = http.createServer(async (req, res) => {
  const route = `${req.method} ${req.url}`;
  if (req.method === "OPTIONS") return send(res, 204, {}, true);
  if (route === "GET /") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(panelHtml());
  }
  const handler = routes[route];
  if (!handler) return send(res, 404, { error: "introuvable" });

  const isPlugin = PLUGIN_ROUTES.has(route);
  // Empêche un site web ouvert dans ton navigateur de lire ou changer tes réglages.
  if (!isPlugin && req.headers.origin && !PANEL_ORIGINS.includes(req.headers.origin)) {
    return send(res, 403, { error: "interdit" });
  }
  try {
    send(res, 200, await handler(req), isPlugin);
  } catch (e) {
    log("Erreur : " + e.message);
    send(res, 500, { error: e.message }, isPlugin);
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
  log(`Pont prêt sur http://localhost:${PORT} — garde cette fenêtre ouverte.`);
  if (!isConfigured()) log("Ajoute ta clé API dans le panneau pour commencer.");
  openPanel();
});
