"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Reuse existing game logic from the root project.
const {
  CHARACTER_POOL,
  ATTACK_ACTIONS,
  DEFENSE_ACTIONS,
  INTEL_ACTIONS,
  NATIONAL_DECISIONS,
  TOWERS,
  createLobby,
  getNation,
  setCharacters,
  buildPlayerSnapshot,
  submitTurn,
  everyoneSubmitted,
  resolveDay,
  forfeitGame,
} = require("./game-core");

admin.initializeApp();
const db = admin.firestore();

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

async function requireUser(req) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) {
    const error = new Error("Missing Authorization bearer token.");
    error.status = 401;
    throw error;
  }
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    const error = new Error("Invalid auth token.");
    error.status = 401;
    throw error;
  }
}

async function readJson(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(String(req.body));
  } catch {
    return {};
  }
}

function normalizeLobbyId(id) {
  return String(id || "").trim().toUpperCase();
}

function randomLobbyCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function lobbyRef(id) {
  return db.collection("lobbies").doc(normalizeLobbyId(id));
}

function requireLobbyMember(lobby, uid) {
  const me = (lobby.players || []).find((p) => p.uid === uid);
  if (!me) {
    const error = new Error("You are not a member of this lobby.");
    error.status = 403;
    throw error;
  }
  return me;
}

function buildLobbyState(lobby, uid) {
  const me = requireLobbyMember(lobby, uid);
  return {
    lobbyId: lobby.id,
    inviteLink: `/ ?lobby=${lobby.id}`.replace(" /", "/"),
    roster: (lobby.players || []).map((player) => ({
      seat: player.seat,
      displayName: player.displayName,
      isBot: Boolean(player.isBot),
      nationName: getNation(lobby.game, player.seat)?.nationName || "Unknown Nation",
    })),
    game: buildPlayerSnapshot(lobby.game, me.seat),
    chat: (lobby.chat || []).slice(-50),
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

function pickSeat(game, existingPlayers) {
  const occupied = new Set((existingPlayers || []).map((p) => p.seat));
  return (game.players || []).find((p) => !occupied.has(p.seat))?.seat ?? null;
}

exports.api = onRequest(
  {
    cors: true,
    region: "us-central1",
  },
  async (req, res) => {
    try {
      const url = new URL(req.url, `https://${req.headers.host}`);
      const pathname = url.pathname;

      if (req.method === "GET" && pathname === "/api/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      const user = await requireUser(req);
      const body = await readJson(req);

      // POST /api/lobbies { displayName, playerCount }
      if (req.method === "POST" && pathname === "/api/lobbies") {
        const requestedPlayerCount = Number(body.playerCount || 4);
        const soloMode = requestedPlayerCount === 1;
        const playerCount = soloMode ? 2 : requestedPlayerCount;
        const displayName = String(body.displayName || "").trim();
        if (!displayName) return sendJson(res, 400, { error: "Display name is required." });
        if (![1, 2, 3, 4].includes(requestedPlayerCount)) {
          return sendJson(res, 400, { error: "Player count must be 1, 2, 3, or 4." });
        }

        let id = randomLobbyCode();
        for (let i = 0; i < 10; i += 1) {
          const existing = await lobbyRef(id).get();
          if (!existing.exists) break;
          id = randomLobbyCode();
        }

        const lobby = createLobby(id, displayName, playerCount, { soloMode });

        // Replace token identity with Firebase uid(s). Bots keep their existing fields.
        lobby.players = (lobby.players || []).map((p) => {
          if (p.isBot) return p;
          return { seat: p.seat, uid: user.uid, displayName, connectedAt: Date.now(), isBot: false };
        });

        await lobbyRef(id).set({
          id,
          createdAt: Date.now(),
          hostSeat: 0,
          soloMode: Boolean(soloMode),
          chat: [],
          game: lobby.game,
          players: lobby.players,
        });

        sendJson(res, 200, {
          lobbyId: id,
          inviteLink: `${url.origin}/?lobby=${id}`,
        });
        return;
      }

      // POST /api/lobbies/:id/join { displayName }
      if (req.method === "POST" && pathname.startsWith("/api/lobbies/") && pathname.endsWith("/join")) {
        const lobbyId = normalizeLobbyId(pathname.split("/")[3]);
        const displayName = String(body.displayName || "").trim();
        if (!displayName) return sendJson(res, 400, { error: "Display name is required." });

        const ref = lobbyRef(lobbyId);
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) {
            const error = new Error("Lobby not found.");
            error.status = 404;
            throw error;
          }
          const lobby = snap.data();
          if ((lobby.players || []).some((p) => p.uid === user.uid)) return;
          if ((lobby.players || []).length >= lobby.game.playerCount) throw new Error("Lobby is full.");
          const seat = pickSeat(lobby.game, lobby.players);
          if (seat == null) throw new Error("No lobby seats are available.");
          lobby.players.push({ seat, uid: user.uid, displayName, connectedAt: Date.now(), isBot: false });
          tx.update(ref, { players: lobby.players });
        });

        sendJson(res, 200, { lobbyId, inviteLink: `${url.origin}/?lobby=${lobbyId}` });
        return;
      }

      // GET /api/state?lobby=XXXX
      if (req.method === "GET" && pathname === "/api/state") {
        const lobbyId = normalizeLobbyId(url.searchParams.get("lobby"));
        const snap = await lobbyRef(lobbyId).get();
        if (!snap.exists) return sendJson(res, 404, { error: "Lobby not found." });
        sendJson(res, 200, buildLobbyState(snap.data(), user.uid));
        return;
      }

      // POST /api/setup { lobbyId, characters }
      if (req.method === "POST" && pathname === "/api/setup") {
        const lobbyId = normalizeLobbyId(body.lobbyId);
        const characters = body.characters || {};
        const ref = lobbyRef(lobbyId);

        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new Error("Lobby not found.");
          const lobby = snap.data();
          const me = requireLobbyMember(lobby, user.uid);
          setCharacters(lobby.game, me.seat, characters);
          tx.update(ref, { game: lobby.game });
        });

        const updated = await ref.get();
        sendJson(res, 200, buildLobbyState(updated.data(), user.uid));
        return;
      }

      // POST /api/submit { lobbyId, submission }
      if (req.method === "POST" && pathname === "/api/submit") {
        const lobbyId = normalizeLobbyId(body.lobbyId);
        const submission = body.submission || {};
        const ref = lobbyRef(lobbyId);

        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new Error("Lobby not found.");
          const lobby = snap.data();
          const me = requireLobbyMember(lobby, user.uid);

          submitTurn(lobby.game, me.seat, submission);
          if (everyoneSubmitted(lobby.game)) {
            resolveDay(lobby.game);
          }
          tx.update(ref, { game: lobby.game });
        });

        const updated = await ref.get();
        sendJson(res, 200, buildLobbyState(updated.data(), user.uid));
        return;
      }

      // POST /api/chat { lobbyId, text }
      if (req.method === "POST" && pathname === "/api/chat") {
        const lobbyId = normalizeLobbyId(body.lobbyId);
        const text = String(body.text || "").trim();
        if (!text) return sendJson(res, 400, { error: "Message cannot be empty." });

        const ref = lobbyRef(lobbyId);
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new Error("Lobby not found.");
          const lobby = snap.data();
          const me = requireLobbyMember(lobby, user.uid);
          lobby.chat = Array.isArray(lobby.chat) ? lobby.chat : [];
          lobby.chat.push({
            seat: me.seat,
            displayName: me.displayName,
            text: text.slice(0, 300),
            sentAt: Date.now(),
          });
          if (lobby.chat.length > 200) lobby.chat = lobby.chat.slice(-200);
          tx.update(ref, { chat: lobby.chat });
        });

        const updated = await ref.get();
        sendJson(res, 200, buildLobbyState(updated.data(), user.uid));
        return;
      }

      // POST /api/forfeit { lobbyId }
      if (req.method === "POST" && pathname === "/api/forfeit") {
        const lobbyId = normalizeLobbyId(body.lobbyId);
        const ref = lobbyRef(lobbyId);

        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new Error("Lobby not found.");
          const lobby = snap.data();
          const me = requireLobbyMember(lobby, user.uid);
          forfeitGame(lobby.game, me.seat);
          tx.update(ref, { game: lobby.game });
        });

        const updated = await ref.get();
        sendJson(res, 200, buildLobbyState(updated.data(), user.uid));
        return;
      }

      // POST /api/leave { lobbyId }
      if (req.method === "POST" && pathname === "/api/leave") {
        const lobbyId = normalizeLobbyId(body.lobbyId);
        const ref = lobbyRef(lobbyId);

        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new Error("Lobby not found.");
          const lobby = snap.data();
          requireLobbyMember(lobby, user.uid);
          lobby.players = (lobby.players || []).filter((p) => p.uid !== user.uid);

          // If no humans remain, delete the lobby.
          const hasHumans = lobby.players.some((p) => !p.isBot);
          if (!hasHumans) {
            tx.delete(ref);
            return;
          }
          tx.update(ref, { players: lobby.players });
        });

        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: "Not found." });
    } catch (error) {
      const status = Number(error?.status || 400);
      sendJson(res, status, { error: error?.message || "Request failed." });
    }
  }
);

