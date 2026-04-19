"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  CHARACTER_POOL,
  ATTACK_ACTIONS,
  DEFENSE_ACTIONS,
  INTEL_ACTIONS,
  NATIONAL_DECISIONS,
  TOWERS,
  createLobby,
  getPlayerRecord,
  getNation,
  joinLobby,
  setCharacters,
  buildPlayerSnapshot,
  submitTurn,
  everyoneSubmitted,
  resolveDay,
} = require("./game-core");

const PORT = Number(process.env.PORT || 3000);
const lobbies = new Map();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function randomLobbyCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getLobby(id) {
  return lobbies.get(String(id || "").toUpperCase()) || null;
}

function buildLobbyState(lobby, token) {
  const playerRecord = getPlayerRecord(lobby, token);
  if (!playerRecord) {
    throw new Error("Invalid player token.");
  }
  return {
    lobbyId: lobby.id,
    inviteLink: `/ ?lobby=${lobby.id}`.replace(" /", "/"),
    roster: lobby.players.map((player) => ({
      seat: player.seat,
      displayName: player.displayName,
      nationName: getNation(lobby.game, player.seat)?.nationName || "Unknown Nation",
    })),
    game: buildPlayerSnapshot(lobby.game, playerRecord.seat),
    constants: {
      towers: TOWERS,
      characters: CHARACTER_POOL,
      attackActions: ATTACK_ACTIONS,
      defenseActions: DEFENSE_ACTIONS,
      intelActions: INTEL_ACTIONS,
      nationalDecisions: NATIONAL_DECISIONS,
    },
  };
}

function serveStatic(req, res, pathname) {
  const filePath = path.join(__dirname, pathname === "/" ? "index.html" : pathname.slice(1));
  if (!filePath.startsWith(__dirname)) {
    sendJson(res, 403, { error: "Forbidden." });
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found." });
      return;
    }
    const ext = path.extname(filePath);
    const contentType = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    }[ext] || "text/plain; charset=utf-8";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if (req.method === "POST" && pathname === "/api/lobbies") {
      const body = await readBody(req);
      const playerCount = Number(body.playerCount || 4);
      const displayName = String(body.displayName || "").trim();
      if (!displayName) {
        sendJson(res, 400, { error: "Display name is required." });
        return;
      }
      if (![2, 3, 4].includes(playerCount)) {
        sendJson(res, 400, { error: "Player count must be 2, 3, or 4." });
        return;
      }
      let id = randomLobbyCode();
      while (lobbies.has(id)) id = randomLobbyCode();
      const lobby = createLobby(id, displayName, playerCount);
      lobbies.set(id, lobby);
      const host = lobby.players[0];
      sendJson(res, 200, {
        lobbyId: id,
        token: host.token,
        inviteLink: `${url.origin}/?lobby=${id}`,
      });
      return;
    }

    if (req.method === "POST" && pathname.startsWith("/api/lobbies/") && pathname.endsWith("/join")) {
      const lobbyId = pathname.split("/")[3];
      const lobby = getLobby(lobbyId);
      if (!lobby) {
        sendJson(res, 404, { error: "Lobby not found." });
        return;
      }
      const body = await readBody(req);
      const displayName = String(body.displayName || "").trim();
      if (!displayName) {
        sendJson(res, 400, { error: "Display name is required." });
        return;
      }
      const player = joinLobby(lobby, displayName);
      sendJson(res, 200, {
        lobbyId: lobby.id,
        token: player.token,
        inviteLink: `${url.origin}/?lobby=${lobby.id}`,
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/state") {
      const lobby = getLobby(url.searchParams.get("lobby"));
      if (!lobby) {
        sendJson(res, 404, { error: "Lobby not found." });
        return;
      }
      const token = url.searchParams.get("token");
      sendJson(res, 200, buildLobbyState(lobby, token));
      return;
    }

    if (req.method === "POST" && pathname === "/api/setup") {
      const body = await readBody(req);
      const lobby = getLobby(body.lobbyId);
      if (!lobby) {
        sendJson(res, 404, { error: "Lobby not found." });
        return;
      }
      const player = getPlayerRecord(lobby, body.token);
      if (!player) {
        sendJson(res, 403, { error: "Invalid player token." });
        return;
      }
      setCharacters(lobby.game, player.seat, body.characters || {});
      sendJson(res, 200, buildLobbyState(lobby, body.token));
      return;
    }

    if (req.method === "POST" && pathname === "/api/submit") {
      const body = await readBody(req);
      const lobby = getLobby(body.lobbyId);
      if (!lobby) {
        sendJson(res, 404, { error: "Lobby not found." });
        return;
      }
      const player = getPlayerRecord(lobby, body.token);
      if (!player) {
        sendJson(res, 403, { error: "Invalid player token." });
        return;
      }
      submitTurn(lobby.game, player.seat, body.submission || {});
      if (everyoneSubmitted(lobby.game)) {
        resolveDay(lobby.game);
      }
      sendJson(res, 200, buildLobbyState(lobby, body.token));
      return;
    }

    if (req.method === "GET" && (pathname === "/" || pathname.endsWith(".js") || pathname.endsWith(".css"))) {
      serveStatic(req, res, pathname);
      return;
    }

    sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Request failed." });
  }
});

server.listen(PORT, () => {
  process.stdout.write(`Art of War server running at http://localhost:${PORT}\n`);
});
