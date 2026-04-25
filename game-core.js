"use strict";

const NATION_NAME_POOL = [
  "Valedawn",
  "Kestrin",
  "Orinth",
  "Mirehold",
  "Solgrave",
  "Tarinth",
  "Ebonreach",
  "Caelmoor",
  "Virelia",
  "Drakemere",
];

const TOWERS = ["Parliament", "Base", "Office"];
const CHARACTER_POOL = ["Aster", "Bram", "Cyra", "Dorian", "Eira", "Fen", "Galen", "Helia", "Ivor", "Junia"];
const ATTACK_ACTIONS = ["Strike", "Target Strike", "Siege Operation", "Coordinated Assault", "Distributed Assault"];
const DEFENSE_ACTIONS = ["Fortify", "Repair", "Evacuation", "Sabotage", "Signal Jam", "Interception", "Counter"];
const INTEL_ACTIONS = ["Deep Surveillance", "Identity Check", "Move Check"];
const NATIONAL_DECISIONS = [
  "War Mobilization",
  "Strategic Reserve",
  "Full Exposure",
  "Priority Target",
  "Leader's Intervention",
  "Total Mobilization",
  "Expanded Command",
];
const BOT_NAMES = ["Iron Regent", "Silent Marshal", "Grey Banner", "Ashen Council"];

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sample(array) {
  if (!array.length) return null;
  return array[Math.floor(Math.random() * array.length)];
}

function randomDistinctCharacters() {
  return shuffle(CHARACTER_POOL).slice(0, 3);
}

function assignCharacters(game, seat, assignments) {
  const nation = getNation(game, seat);
  TOWERS.forEach((tower) => {
    nation.towers[tower].character = assignments[tower];
  });
  nation.ready = true;
}

function createGame(playerCount) {
  const towerMaxHp = playerCount === 2 ? 200 : 300;
  const nationNames = shuffle(NATION_NAME_POOL).slice(0, playerCount);
  return {
    day: 1,
    maxDays: 10,
    playerCount,
    towerMaxHp,
    started: false,
    finished: false,
    winnerSeat: null,
    winReason: "",
    globalFirstTowerDestroyed: false,
    treaties: [],
    pendingTreatyOffers: [],
    nextTreatyOfferId: 1,
    pendingSieges: [],
    previousAttackTargets: {},
    players: nationNames.map((name, index) => ({
      seat: index,
      nationName: name,
      gold: 200,
      score: 0,
      totalMobilization: false,
      fullExposureUsed: {},
      intel: [],
      resolutionHistory: {},
      ready: false,
      lastSubmittedDay: 0,
      towers: {
        Parliament: { hp: towerMaxHp, character: null },
        Base: { hp: towerMaxHp, character: null },
        Office: { hp: towerMaxHp, character: null },
      },
    })),
  };
}

function publicPlayerView(player) {
  return {
    seat: player.seat,
    nationName: player.nationName,
    score: player.score,
    towers: Object.fromEntries(TOWERS.map((tower) => [tower, { hp: player.towers[tower].hp }])),
    ready: player.ready,
    submitted: player.lastSubmittedDay > 0,
  };
}

function createBotPlayer(seat) {
  return {
    seat,
    displayName: sample(BOT_NAMES) || "AI Commander",
    token: createToken(),
    connectedAt: Date.now(),
    isBot: true,
  };
}

function createLobby(id, hostName, playerCount, options = {}) {
  const game = createGame(playerCount);
  const lobby = {
    id,
    createdAt: Date.now(),
    hostSeat: 0,
    soloMode: Boolean(options.soloMode),
    game,
    players: [
      {
        seat: 0,
        displayName: hostName,
        token: createToken(),
        connectedAt: Date.now(),
        isBot: false,
      },
    ],
  };
  if (lobby.soloMode) {
    const bot = createBotPlayer(1);
    lobby.players.push(bot);
    const characters = randomDistinctCharacters();
    assignCharacters(game, bot.seat, {
      Parliament: characters[0],
      Base: characters[1],
      Office: characters[2],
    });
  }
  return lobby;
}

function createToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function getPlayerRecord(lobby, token) {
  return lobby.players.find((player) => player.token === token) || null;
}

function getNation(game, seat) {
  if (seat == null) return null;
  return game.players.find((player) => player.seat === seat);
}

function joinLobby(lobby, displayName) {
  if (lobby.players.length >= lobby.game.playerCount) {
    throw new Error("Lobby is full.");
  }
  const occupiedSeats = new Set(lobby.players.map((player) => player.seat));
  const seat = lobby.game.players.find((player) => !occupiedSeats.has(player.seat))?.seat;
  if (seat == null) {
    throw new Error("No lobby seats are available.");
  }
  const player = {
    seat,
    displayName,
    token: createToken(),
    connectedAt: Date.now(),
    isBot: false,
  };
  lobby.players.push(player);
  return player;
}

function resetNationForLobbySeat(game, seat) {
  const nation = getNation(game, seat);
  if (!nation) return;
  nation.gold = 200;
  nation.score = 0;
  nation.totalMobilization = false;
  nation.fullExposureUsed = {};
  nation.intel = [];
  nation.resolutionHistory = {};
  nation.ready = false;
  nation.lastSubmittedDay = 0;
  nation.pendingTurn = null;
  TOWERS.forEach((tower) => {
    nation.towers[tower] = {
      hp: game.towerMaxHp,
      character: null,
    };
  });
}

function leaveLobby(lobby, token) {
  if (lobby.game.started) {
    throw new Error("The match has already started.");
  }
  const player = getPlayerRecord(lobby, token);
  if (!player) {
    throw new Error("Invalid player token.");
  }
  lobby.players = lobby.players.filter((entry) => entry.token !== token);
  resetNationForLobbySeat(lobby.game, player.seat);
  if (lobby.hostSeat === player.seat) {
    lobby.hostSeat = lobby.players[0]?.seat ?? 0;
  }
  return player.seat;
}

function setCharacters(game, seat, assignments) {
  const nation = getNation(game, seat);
  const values = TOWERS.map((tower) => assignments[tower]).filter(Boolean);
  if (values.length !== 3 || new Set(values).size !== 3) {
    throw new Error("Choose three distinct characters.");
  }
  assignCharacters(game, seat, assignments);
  if (game.players.every((player) => player.ready)) {
    game.started = true;
  }
}

function forfeitGame(game, seat) {
  const forfeitingNation = getNation(game, seat);
  if (!forfeitingNation) {
    throw new Error("Player seat is no longer available in this match.");
  }
  if (!game.started || game.finished) {
    throw new Error("Game is not currently active.");
  }

  TOWERS.forEach((tower) => {
    forfeitingNation.towers[tower].hp = 0;
  });
  forfeitingNation.pendingTurn = null;
  forfeitingNation.lastSubmittedDay = game.day;
  game.finished = true;

  game.players.forEach((player) => {
    if (player.seat !== seat) {
      player.score += 100;
      game.winnerSeat = player.seat;
    }
  });
  game.winReason = "forfeit";
}

function activeActionLimit(player, decision) {
  let count = player.towers.Base.hp > 0 ? 3 : 2;
  if (decision?.type === "War Mobilization") count += 1;
  if (decision?.type === "Expanded Command") return 8;
  return count;
}

function totalHealth(player) {
  return TOWERS.reduce((sum, tower) => sum + player.towers[tower].hp, 0);
}

function actionCost(type) {
  const table = {
    Strike: 30,
    "Target Strike": 40,
    "Siege Operation": 80,
    "Coordinated Assault": 45,
    "Distributed Assault": 50,
    Fortify: 45,
    Repair: 30,
    Evacuation: 70,
    Sabotage: 50,
    "Signal Jam": 40,
    Interception: 50,
    Counter: 70,
    "Deep Surveillance": 100,
    "Identity Check": 40,
    "Move Check": 60,
  };
  return table[type] || 0;
}

function decisionCost(type) {
  const table = {
    "War Mobilization": 0,
    "Strategic Reserve": 0,
    "Full Exposure": 0,
    "Priority Target": 30,
    "Leader's Intervention": 65,
    "Total Mobilization": 150,
    "Expanded Command": 70,
  };
  return table[type] || 0;
}

function normalizeDecisionGuesses(decision) {
  if (Array.isArray(decision?.guess)) {
    return decision.guess;
  }
  if (decision?.guesses && typeof decision.guesses === "object") {
    return TOWERS.map((tower) => decision.guesses[tower] || "");
  }
  return [];
}

function buildPlayerSnapshot(game, seat) {
  const nation = getNation(game, seat);
  if (!nation) {
    throw new Error("Player seat is no longer available in this match.");
  }
  return {
    playerSeat: seat,
    nationName: nation.nationName,
    displayDay: Math.min(game.day, game.maxDays),
    started: game.started,
    finished: game.finished,
    winnerSeat: game.winnerSeat,
    winReason: game.winReason,
    towerMaxHp: game.towerMaxHp,
    playerCount: game.playerCount,
    you: {
      seat: nation.seat,
      nationName: nation.nationName,
      gold: nation.gold,
      score: nation.score,
      towers: nation.towers,
      totalMobilization: nation.totalMobilization,
      fullExposureUsed: nation.fullExposureUsed,
      intel: nation.intel.slice(-8),
      ready: nation.ready,
      lastSubmittedDay: nation.lastSubmittedDay,
      activeTreaties: game.treaties
        .filter((treaty) => treaty.active && (treaty.a === seat || treaty.b === seat))
        .map((treaty) => {
          const otherSeat = treaty.a === seat ? treaty.b : treaty.a;
          const otherNation = getNation(game, otherSeat);
          if (!otherNation) return null;
          return {
            withSeat: otherSeat,
            withNation: otherNation.nationName,
            remaining: treaty.remaining,
          };
        })
        .filter(Boolean),
      incomingTreaties: game.pendingTreatyOffers
        .filter((offer) => offer.to === seat && offer.dayProposed < game.day)
        .map((offer) => {
          const fromNation = getNation(game, offer.from);
          if (!fromNation) return null;
          return {
            offerId: offer.id,
            fromSeat: offer.from,
            fromNation: fromNation.nationName,
            duration: offer.duration,
          };
        })
        .filter(Boolean),
      logDays: Object.keys(nation.resolutionHistory).map(Number).sort((a, b) => a - b),
      resolutionHistory: nation.resolutionHistory,
    },
    nations: game.players.map(publicPlayerView),
    moveData: {
      towers: TOWERS,
      characters: CHARACTER_POOL,
      attackActions: ATTACK_ACTIONS,
      defenseActions: DEFENSE_ACTIONS,
      intelActions: INTEL_ACTIONS,
      nationalDecisions: NATIONAL_DECISIONS,
    },
  };
}

function submitTurn(game, seat, submission) {
  const nation = getNation(game, seat);
  if (!nation) {
    throw new Error("Player seat is no longer available in this match.");
  }
  if (!game.started || game.finished) {
    throw new Error("Game is not accepting turns.");
  }
  if (nation.lastSubmittedDay === game.day) {
    throw new Error("Turn already submitted.");
  }

  const decision = submission.decision || null;
  const actions = Array.isArray(submission.actions) ? submission.actions : [];
  const allowedActions = activeActionLimit(nation, decision);
  if (actions.length > allowedActions) {
    throw new Error("Too many actions submitted.");
  }
  validateSubmission(game, nation, submission.treaty || null, decision, actions);

  nation.pendingTurn = {
    seat,
    decision,
    treaty: submission.treaty || null,
    treatyResponses: submission.treatyResponses || [],
    actions: actions.map((action) => ({
      ...action,
      seat,
      targets: Array.isArray(action.targets)
        ? action.targets.map((target) => ({ ...target }))
        : action.targets,
    })),
  };
  nation.lastSubmittedDay = game.day;
}

function buildBotSubmission(game, seat) {
  const nation = getNation(game, seat);
  if (!nation || !nation.ready || nation.lastSubmittedDay === game.day || game.finished) {
    return null;
  }

  const ownAliveTowers = TOWERS.filter((tower) => nation.towers[tower].hp > 0);
  const damagedOwnTowers = ownAliveTowers.filter((tower) => nation.towers[tower].hp < game.towerMaxHp)
    .sort((left, right) => nation.towers[left].hp - nation.towers[right].hp);
  const enemyNations = game.players.filter((player) => player.seat !== seat);
  const enemyTargets = enemyNations.flatMap((player) => TOWERS
    .filter((tower) => player.towers[tower].hp > 0)
    .map((tower) => ({ targetSeat: player.seat, targetTower: tower })));

  let decision = null;
  let remainingGold = nation.gold;
  if (nation.towers.Office.hp > 0 && remainingGold < 60) {
    decision = { type: "Strategic Reserve", targetSeat: null, payload: "", guess: [], guesses: {} };
    remainingGold += 50;
  }

  const actions = [];
  const usedMoves = new Set();
  const actionLimit = activeActionLimit(nation, decision);
  const tryAdd = (action) => {
    if (!action || usedMoves.has(action.type) || actions.length >= actionLimit) return false;
    const cost = actionCost(action.type);
    if (remainingGold < cost) return false;
    usedMoves.add(action.type);
    remainingGold -= cost;
    actions.push(action);
    return true;
  };

  if (damagedOwnTowers.length && remainingGold >= actionCost("Repair")) {
    tryAdd({ type: "Repair", targetSeat: null, targetTower: damagedOwnTowers[0], guess: "" });
  }
  if (ownAliveTowers.length && remainingGold >= actionCost("Fortify")) {
    tryAdd({ type: "Fortify", targetSeat: null, targetTower: damagedOwnTowers[0] || ownAliveTowers[0], guess: "" });
  }
  if (ownAliveTowers.some((tower) => nation.towers[tower].hp <= 70 && nation.towers[tower].hp > 1) && remainingGold >= actionCost("Evacuation")) {
    const targetTower = ownAliveTowers
      .filter((tower) => nation.towers[tower].hp > 1)
      .sort((left, right) => nation.towers[left].hp - nation.towers[right].hp)[0];
    tryAdd({ type: "Evacuation", targetSeat: null, targetTower, guess: "" });
  }

  const randomTarget = () => sample(enemyTargets);
  if (enemyTargets.length) {
    const strikeTarget = randomTarget();
    tryAdd({ type: "Strike", targetSeat: strikeTarget?.targetSeat ?? null, targetTower: strikeTarget?.targetTower ?? "", guess: "" });
  }
  if (enemyTargets.length) {
    const targetStrikeTarget = randomTarget();
    tryAdd({
      type: "Target Strike",
      targetSeat: targetStrikeTarget?.targetSeat ?? null,
      targetTower: targetStrikeTarget?.targetTower ?? "",
      guess: sample(CHARACTER_POOL) || "",
    });
  }
  if (enemyTargets.length) {
    const siegeTarget = randomTarget();
    tryAdd({
      type: "Siege Operation",
      targetSeat: siegeTarget?.targetSeat ?? null,
      targetTower: siegeTarget?.targetTower ?? "",
      guess: sample(CHARACTER_POOL) || "",
    });
  }
  if (remainingGold >= actionCost("Counter")) {
    tryAdd({ type: "Counter", targetSeat: null, targetTower: "", guess: "" });
  } else if (remainingGold >= actionCost("Signal Jam")) {
    tryAdd({ type: "Signal Jam", targetSeat: null, targetTower: "", guess: "" });
  }
  if (enemyNations.length && remainingGold >= actionCost("Move Check")) {
    tryAdd({ type: "Move Check", targetSeat: sample(enemyNations)?.seat ?? null, targetTower: "", guess: "" });
  }

  return {
    decision,
    treaty: null,
    treatyResponses: [],
    actions,
  };
}

function validateSubmission(game, nation, treaty, decision, actions) {
  if (!nation) {
    throw new Error("Nation not found.");
  }

  const enemySeats = new Set(game.players.map((player) => player.seat).filter((seat) => seat !== nation.seat));
  const validTower = (tower) => TOWERS.includes(tower);
  const validCharacter = (character) => CHARACTER_POOL.includes(character);
  const validAction = (type) => [...ATTACK_ACTIONS, ...DEFENSE_ACTIONS, ...INTEL_ACTIONS].includes(type);
  const requireEnemySeat = (seat, label) => {
    if (!enemySeats.has(seat)) {
      throw new Error(`${label} needs a valid enemy nation.`);
    }
  };

  if (decision && !NATIONAL_DECISIONS.includes(decision.type)) {
    throw new Error("Selected national decision is invalid.");
  }

  if (treaty) {
    if (game.playerCount === 2) {
      throw new Error("Treaties are disabled in 2-player matches.");
    }
    requireEnemySeat(treaty.targetSeat, "Treaty proposal");
    if (![1, 2, 3].includes(Number(treaty.duration))) {
      throw new Error("Treaty proposal needs a valid duration.");
    }
  }

  if (decision?.type === "Priority Target") {
    requireEnemySeat(decision.targetSeat, "Priority Target");
    if (!validTower(decision.payload)) {
      throw new Error("Priority Target needs a nation and tower.");
    }
  }
  if (decision?.type === "Leader's Intervention") {
    requireEnemySeat(decision.targetSeat, "Leader's Intervention");
    if (![...ATTACK_ACTIONS, ...DEFENSE_ACTIONS, ...INTEL_ACTIONS].includes(decision.payload)) {
      throw new Error("Leader's Intervention needs a nation and an action.");
    }
  }
  if (decision?.type === "Full Exposure") {
    requireEnemySeat(decision.targetSeat, "Full Exposure");
    const guesses = normalizeDecisionGuesses(decision);
    if (guesses.length !== 3 || guesses.some((guess) => !validCharacter(guess))) {
      throw new Error("Full Exposure needs a nation and all three tower guesses.");
    }
  }

  if (!nation.totalMobilization) {
    const seen = new Set();
    for (const action of actions) {
      if (!action?.type) continue;
      if (seen.has(action.type)) {
        throw new Error("Repeated moves are not allowed for your nation.");
      }
      seen.add(action.type);
    }
  }

  for (const action of actions) {
    if (!validAction(action?.type)) {
      throw new Error("One of the selected moves is invalid.");
    }

    if (game.playerCount === 2 && action.type === "Interception") {
      throw new Error("Interception is disabled in 2-player matches.");
    }

    if (["Strike", "Target Strike", "Siege Operation", "Coordinated Assault", "Deep Surveillance", "Identity Check", "Move Check", "Interception"].includes(action.type)) {
      requireEnemySeat(action.targetSeat, action.type);
    }

    if (["Strike", "Target Strike", "Siege Operation", "Coordinated Assault", "Fortify", "Repair", "Evacuation", "Sabotage", "Deep Surveillance"].includes(action.type) && !validTower(action.targetTower)) {
      throw new Error(`${action.type} needs a valid tower.`);
    }

    if (["Target Strike", "Siege Operation", "Identity Check"].includes(action.type) && !validCharacter(action.guess)) {
      throw new Error(`${action.type} needs a valid character guess.`);
    }

    if (action?.type === "Distributed Assault") {
      if (!Array.isArray(action.targets) || action.targets.length === 0) {
        throw new Error("Distributed Assault needs at least one target.");
      }
      const seenTargets = new Set();
      for (const target of action.targets || []) {
        requireEnemySeat(target.targetSeat, "Distributed Assault");
        if (!validTower(target.targetTower)) {
          throw new Error("Distributed Assault needs a valid target tower.");
        }
        if (target.guess && !validCharacter(target.guess)) {
          throw new Error("Distributed Assault has an invalid character guess.");
        }
        const key = `${target.targetSeat}:${target.targetTower}`;
        if (seenTargets.has(key)) {
          throw new Error("Distributed Assault cannot target the same tower twice on the same nation.");
        }
        seenTargets.add(key);
      }
    }
  }
}

function everyoneSubmitted(game) {
  return game.players.every((player) => player.lastSubmittedDay === game.day);
}

function addPlayerResult(resolution, seat, category, text, label) {
  if (!resolution.playerResults[seat]) {
    resolution.playerResults[seat] = {
      economy: [],
      decision: [],
      jamming: [],
      defense: [],
      attack: [],
      intel: [],
      summary: [],
    };
  }
  resolution.playerResults[seat][category].push(label ? { label, text } : text);
}

function compareDayRanking(a, b, resolution) {
  const towerDiff = resolution.towersDestroyedBy[b.seat] - resolution.towersDestroyedBy[a.seat];
  if (towerDiff !== 0) return towerDiff;
  const damageDiff = resolution.damageDealt[b.seat] - resolution.damageDealt[a.seat];
  if (damageDiff !== 0) return damageDiff;
  const takenDiff = resolution.damageTaken[a.seat] - resolution.damageTaken[b.seat];
  if (takenDiff !== 0) return takenDiff;
  return resolution.dayStartHealth[b.seat] - resolution.dayStartHealth[a.seat];
}

function resolveDay(game) {
  const resolvingDay = game.day;
  const submissions = game.players.map((player) => player.pendingTurn);
  const resolution = {
    dayStartHealth: {},
    attacks: [],
    intel: [],
    blockedAttackers: new Set(),
    signalJams: new Set(),
    priorityTargets: {},
    leaderInterventions: [],
    fortifyMap: {},
    evacuationMap: {},
    counters: {},
    damageDealt: {},
    damageTaken: {},
    towersDestroyedBy: {},
    currentDayAttackTargets: {},
    playerResults: {},
    towerDamageByPlayer: {},
  };

  game.players.forEach((player) => {
    resolution.dayStartHealth[player.seat] = totalHealth(player);
    resolution.damageDealt[player.seat] = 0;
    resolution.damageTaken[player.seat] = 0;
    resolution.towersDestroyedBy[player.seat] = 0;
    resolution.currentDayAttackTargets[player.seat] = [];
    resolution.towerDamageByPlayer[player.seat] = { Parliament: 0, Base: 0, Office: 0 };
  });

  resolveTreaties(game, submissions);
  resolveNationalDecisions(game, submissions, resolution);
  gatherActions(game, submissions, resolution);
  resolveAttacks(game, resolution);
  resolveIntel(game, submissions, resolution);
  decayTreaties(game);
  scoreDay(game, resolution, resolvingDay);
  finalizeLogs(game, resolution, resolvingDay);

  game.players.forEach((player) => {
    game.previousAttackTargets[player.seat] = resolution.currentDayAttackTargets[player.seat];
    player.pendingTurn = null;
  });

  const alivePlayers = game.players.filter((player) => totalHealth(player) > 0);
  if (alivePlayers.length === 1) {
    finishGame(game, alivePlayers[0].seat, "conquest");
  } else if (game.day >= game.maxDays) {
    finishGame(game);
  } else {
    game.day += 1;
  }
}

function resolveTreaties(game, submissions) {
  if (game.playerCount === 2) {
    game.pendingTreatyOffers = [];
    game.treaties = [];
    return;
  }
  submissions.forEach((entry) => {
    (entry.treatyResponses || []).forEach((response) => {
      const offer = game.pendingTreatyOffers.find((candidate) => candidate.id === response.offerId);
      if (!offer) return;
      if (response.response === "accept") {
        const reciprocalOffer = game.pendingTreatyOffers.find((candidate) => candidate.from === offer.to && candidate.to === offer.from);
        const duration = Math.max(offer.duration, reciprocalOffer?.duration || 0);
        game.treaties.push({ a: offer.from, b: offer.to, remaining: duration, active: true });
        if (reciprocalOffer) {
          game.pendingTreatyOffers = game.pendingTreatyOffers.filter((candidate) => candidate.id !== reciprocalOffer.id);
        }
      }
      game.pendingTreatyOffers = game.pendingTreatyOffers.filter((candidate) => candidate.id !== offer.id);
    });
  });

  submissions.forEach((entry) => {
    const proposal = entry.treaty;
    if (!proposal) return;
    const nation = getNation(game, entry.seat);
    if (nation.towers.Parliament.hp <= 0) return;
    const exists = game.pendingTreatyOffers.some((offer) => offer.from === entry.seat && offer.to === proposal.targetSeat);
    if (exists) return;
    game.pendingTreatyOffers.push({
      id: game.nextTreatyOfferId,
      from: entry.seat,
      to: proposal.targetSeat,
      duration: proposal.duration,
      dayProposed: game.day,
    });
    game.nextTreatyOfferId += 1;
  });
}

function resolveNationalDecisions(game, submissions, resolution) {
  submissions.forEach((entry) => {
    const decision = entry.decision;
    if (!decision) return;
    const nation = getNation(game, entry.seat);
    if (nation.towers.Office.hp <= 0) return;
    const cost = decisionCost(decision.type);
    if (nation.gold < cost) return;
    nation.gold -= cost;

    if (decision.type === "Strategic Reserve") {
      nation.gold += 50;
      addPlayerResult(resolution, entry.seat, "decision", "Successful: +50 gold", "Strategic Reserve");
    }
    if (decision.type === "Priority Target" && decision.targetSeat !== null && decision.payload) {
      resolution.priorityTargets[entry.seat] = { targetSeat: decision.targetSeat, targetTower: decision.payload };
      addPlayerResult(resolution, entry.seat, "decision", `Successful: ${getNation(game, decision.targetSeat).nationName} ${decision.payload}`, "Priority Target");
    }
    if (decision.type === "Leader's Intervention" && decision.targetSeat !== null && decision.payload) {
      resolution.leaderInterventions.push({
        sourceSeat: entry.seat,
        targetSeat: decision.targetSeat,
        targetNation: getNation(game, decision.targetSeat).nationName,
        actionType: decision.payload,
        triggered: false,
      });
    }
    if (decision.type === "War Mobilization") {
      addPlayerResult(resolution, entry.seat, "decision", "Successful: +1 action", "War Mobilization");
    }
    if (decision.type === "Expanded Command") {
      addPlayerResult(resolution, entry.seat, "decision", "Successful", "Expanded Command");
    }
    if (decision.type === "Total Mobilization") {
      nation.totalMobilization = true;
      addPlayerResult(resolution, entry.seat, "decision", "Successful", "Total Mobilization");
    }
    if (decision.type === "Full Exposure" && decision.targetSeat !== null) {
      if (!nation.fullExposureUsed[decision.targetSeat]) {
        nation.fullExposureUsed[decision.targetSeat] = true;
        const target = getNation(game, decision.targetSeat);
        const guesses = normalizeDecisionGuesses(decision).filter(Boolean);
        const actual = TOWERS.map((tower) => target.towers[tower].character);
        const success = guesses.length === 3 && guesses.every((guess, index) => guess === actual[index]);
        if (success) {
          nation.gold += 200;
          addPlayerResult(resolution, entry.seat, "decision", `Successful: ${target.nationName} fully exposed`, "Full Exposure");
        } else {
          addPlayerResult(resolution, entry.seat, "decision", `Failure: ${target.nationName} not fully exposed`, "Full Exposure");
        }
      }
    }
  });
}

function filterRepeated(gamePlayer, actions) {
  if (gamePlayer.totalMobilization) return actions;
  const seen = new Set();
  return actions.filter((action) => {
    if (seen.has(action.type)) return false;
    seen.add(action.type);
    return true;
  });
}

function gatherActions(game, submissions, resolution) {
  submissions.forEach((entry) => {
    const nation = getNation(game, entry.seat);
    const actions = filterRepeated(nation, entry.actions || []);
    actions.forEach((action) => {
      const matchingIntervention = resolution.leaderInterventions.find((intervention) => intervention.targetSeat === entry.seat && intervention.actionType === action.type);
      if (matchingIntervention) {
        matchingIntervention.triggered = true;
        const category = ATTACK_ACTIONS.includes(action.type) ? "attack" : INTEL_ACTIONS.includes(action.type) ? "intel" : ["Sabotage", "Signal Jam", "Interception", "Counter"].includes(action.type) ? "jamming" : "defense";
        const text = ATTACK_ACTIONS.includes(action.type) && action.targetTower && action.targetSeat !== null
          ? `Failure on ${getNation(game, action.targetSeat).nationName} ${action.targetTower}`
          : "Failure";
        addPlayerResult(resolution, entry.seat, category, text, action.type);
        return;
      }
      const cost = actionCost(action.type);
      if (nation.gold < cost) {
        addPlayerResult(resolution, entry.seat, ATTACK_ACTIONS.includes(action.type) ? "attack" : INTEL_ACTIONS.includes(action.type) ? "intel" : "defense", "Failure: Not enough gold", action.type);
        return;
      }
      nation.gold -= cost;

      if (DEFENSE_ACTIONS.includes(action.type)) {
        queueDefense(game, action, resolution);
      } else if (ATTACK_ACTIONS.includes(action.type)) {
        resolution.attacks.push(action);
      } else if (INTEL_ACTIONS.includes(action.type)) {
        resolution.intel.push(action);
      }
    });
  });

  resolution.leaderInterventions.forEach((intervention) => {
    addPlayerResult(
      resolution,
      intervention.sourceSeat,
      "decision",
      intervention.triggered
        ? `Successful: ${intervention.targetNation} used ${intervention.actionType}`
        : `Failure: ${intervention.targetNation} did not use ${intervention.actionType}`,
      "Leader's Intervention"
    );
  });

  game.pendingSieges.forEach((siege) => {
    if (siege.dayToResolve === game.day) {
      resolution.attacks.push({ seat: siege.seat, type: "Queued Siege", targetSeat: siege.targetSeat, targetTower: siege.targetTower, guess: siege.guess });
    }
  });
  game.pendingSieges = game.pendingSieges.filter((siege) => siege.dayToResolve > game.day);
}

function queueDefense(game, action, resolution) {
  const nation = getNation(game, action.seat);
  if (action.type === "Fortify" && action.targetTower) {
    resolution.fortifyMap[`${action.seat}:${action.targetTower}`] = true;
    addPlayerResult(resolution, action.seat, "defense", `Successful on ${action.targetTower}`, "Fortify");
  }
  if (action.type === "Repair" && action.targetTower) {
    const before = nation.towers[action.targetTower].hp;
    nation.towers[action.targetTower].hp = Math.min(game.towerMaxHp, before + 40);
    const healed = nation.towers[action.targetTower].hp - before;
    addPlayerResult(resolution, action.seat, "defense", `Successful on ${action.targetTower}: +${healed} HP`, "Repair");
  }
  if (action.type === "Evacuation" && action.targetTower) {
    resolution.evacuationMap[`${action.seat}:${action.targetTower}`] = true;
    addPlayerResult(resolution, action.seat, "defense", `Successful on ${action.targetTower}`, "Evacuation");
  }
  if (action.type === "Signal Jam") {
    resolution.signalJams.add(action.seat);
    addPlayerResult(resolution, action.seat, "jamming", "Successful", "Signal Jam");
  }
  if (action.type === "Sabotage" && action.targetTower) {
    const index = game.pendingSieges.findIndex((siege) => siege.dayToResolve === game.day && siege.targetSeat === action.seat && siege.targetTower === action.targetTower);
    if (index >= 0) {
      game.pendingSieges.splice(index, 1);
      addPlayerResult(resolution, action.seat, "jamming", `Successful on ${action.targetTower}`, "Sabotage");
    } else {
      addPlayerResult(resolution, action.seat, "jamming", `Failure on ${action.targetTower}: No siege found`, "Sabotage");
    }
  }
  if (action.type === "Interception" && action.targetSeat !== null) {
    resolution.blockedAttackers.add(`${action.seat}:${action.targetSeat}`);
    addPlayerResult(resolution, action.seat, "jamming", "Successful", "Interception");
  }
  if (action.type === "Counter") {
    resolution.counters[action.seat] = true;
    addPlayerResult(resolution, action.seat, "jamming", "Successful", "Counter");
  }
}

function treatyBlocking(game, seatA, seatB) {
  return game.treaties.find((treaty) => treaty.active && ((treaty.a === seatA && treaty.b === seatB) || (treaty.a === seatB && treaty.b === seatA)));
}

function lowestAliveTower(player) {
  return TOWERS.filter((tower) => player.towers[tower].hp > 0).sort((a, b) => player.towers[a].hp - player.towers[b].hp)[0] || null;
}

function applyDamage(game, resolution, sourceSeat, targetSeat, targetTower, amount, sourceLabel) {
  if (amount <= 0) return;
  const targetPlayer = getNation(game, targetSeat);
  if (!targetPlayer || targetPlayer.towers[targetTower].hp <= 0) return;
  const fortify = resolution.fortifyMap[`${targetSeat}:${targetTower}`];
  const finalDamage = fortify ? Math.ceil(amount * 0.7) : amount;
  const before = targetPlayer.towers[targetTower].hp;
  let after = Math.max(0, before - finalDamage);
  if (after === 0 && before > 1 && resolution.evacuationMap[`${targetSeat}:${targetTower}`]) {
    after = 1;
    delete resolution.evacuationMap[`${targetSeat}:${targetTower}`];
  }
  targetPlayer.towers[targetTower].hp = after;
  resolution.damageDealt[sourceSeat] += finalDamage;
  resolution.damageTaken[targetSeat] += finalDamage;
  resolution.towerDamageByPlayer[targetSeat][targetTower] += finalDamage;
  resolution.currentDayAttackTargets[sourceSeat].push(`${targetSeat}:${targetTower}`);
  if (before > 0 && after === 0) {
    resolution.towersDestroyedBy[sourceSeat] += 1;
    const source = getNation(game, sourceSeat);
    if (!game.globalFirstTowerDestroyed) {
      game.globalFirstTowerDestroyed = true;
      source.score += 200;
    } else {
      source.score += 100;
    }
  }
}

function calculateDamage(game, action, attacker, defender, resolution) {
  const guessedCorrectly = action.guess && defender.towers[action.targetTower]?.character === action.guess;
  const priority = resolution.priorityTargets[attacker.seat];
  const priorityBonus = priority && priority.targetSeat === defender.seat && priority.targetTower === action.targetTower ? 15 : 0;
  if (action.type === "Strike") return 30 + priorityBonus;
  if (action.type === "Target Strike") return (guessedCorrectly ? 80 : 40) + priorityBonus;
  if (action.type === "Queued Siege") return (guessedCorrectly ? 160 : 120) + priorityBonus;
  if (action.type === "Coordinated Assault") {
    const attackedLastRound = (game.previousAttackTargets[attacker.seat] || []).includes(`${defender.seat}:${action.targetTower}`);
    return attackedLastRound ? 60 + priorityBonus : 0;
  }
  return 0;
}

function resolveAttacks(game, resolution) {
  resolution.attacks.forEach((action) => {
    if (action.type === "Distributed Assault") {
      resolveDistributedAssault(game, action, resolution);
      return;
    }
    const attacker = getNation(game, action.seat);
    const defender = getNation(game, action.targetSeat);
    if (!attacker || !defender || !action.targetTower) return;
    if (action.type === "Siege Operation") {
      game.pendingSieges.push({ seat: attacker.seat, targetSeat: defender.seat, targetTower: action.targetTower, guess: action.guess, dayToResolve: game.day + 1 });
      addPlayerResult(resolution, attacker.seat, "attack", `Successful on ${defender.nationName} ${action.targetTower}`, "Siege Operation");
      addPlayerResult(resolution, defender.seat, "summary", `Incoming siege prepared against ${action.targetTower}`);
      return;
    }
    if (treatyBlocking(game, attacker.seat, defender.seat)) {
      addPlayerResult(resolution, attacker.seat, "attack", `Failure on ${defender.nationName} ${action.targetTower}: Active treaty with this nation is now broken`, action.type);
      return;
    }
    if (resolution.blockedAttackers.has(`${defender.seat}:${attacker.seat}`)) {
      addPlayerResult(resolution, attacker.seat, "attack", `Failure on ${defender.nationName} ${action.targetTower}: Intercepted`, action.type);
      return;
    }
    if (resolution.counters[defender.seat]) {
      resolution.counters[defender.seat] = false;
      const rebound = attacker.towers[action.targetTower].hp > 0 ? action.targetTower : lowestAliveTower(attacker);
      if (rebound) applyDamage(game, resolution, defender.seat, attacker.seat, rebound, 60, "Counter");
      addPlayerResult(resolution, attacker.seat, "attack", `Failure on ${defender.nationName} ${action.targetTower}: Countered`, action.type);
      return;
    }
    if (defender.towers[action.targetTower].hp <= 0) {
      addPlayerResult(resolution, attacker.seat, "attack", `Failure on ${defender.nationName} ${action.targetTower}: Target tower already destroyed`, action.type);
      return;
    }
    const damage = calculateDamage(game, action, attacker, defender, resolution);
    if (damage > 0) {
      const finalDamage = resolution.fortifyMap[`${defender.seat}:${action.targetTower}`] ? Math.ceil(damage * 0.7) : damage;
      addPlayerResult(resolution, attacker.seat, "attack", `Successful on ${defender.nationName} ${action.targetTower}: ${finalDamage} damage`, action.type);
      applyDamage(game, resolution, attacker.seat, defender.seat, action.targetTower, damage, action.type);
    } else {
      addPlayerResult(resolution, attacker.seat, "attack", `Failure on ${defender.nationName} ${action.targetTower}`, action.type);
    }
  });
}

function resolveDistributedAssault(game, action, resolution) {
  const attacker = getNation(game, action.seat);
  const messages = [];
  (action.targets || []).forEach((target) => {
    const defender = getNation(game, target.targetSeat);
    if (!defender || !target.targetTower || defender.towers[target.targetTower].hp <= 0) {
      messages.push(`Failure on unknown target ${target.targetTower || "tower"}: Invalid target`);
      return;
    }
    if (treatyBlocking(game, attacker.seat, defender.seat)) {
      messages.push(`Failure on ${defender.nationName} ${target.targetTower}: Active treaty with this nation is now broken`);
      return;
    }
    if (resolution.blockedAttackers.has(`${defender.seat}:${attacker.seat}`)) {
      messages.push(`Failure on ${defender.nationName} ${target.targetTower}: Intercepted`);
      return;
    }
    if (resolution.counters[defender.seat]) {
      resolution.counters[defender.seat] = false;
      const rebound = attacker.towers[target.targetTower].hp > 0 ? target.targetTower : lowestAliveTower(attacker);
      if (rebound) applyDamage(game, resolution, defender.seat, attacker.seat, rebound, 60, "Counter");
      messages.push(`Failure on ${defender.nationName} ${target.targetTower}: Countered`);
      return;
    }
    const guessed = target.guess && defender.towers[target.targetTower].character === target.guess;
    const priority = resolution.priorityTargets[attacker.seat];
    const priorityBonus = priority && priority.targetSeat === defender.seat && priority.targetTower === target.targetTower ? 15 : 0;
    const amount = (guessed ? 25 : 15) + priorityBonus;
    const finalDamage = resolution.fortifyMap[`${defender.seat}:${target.targetTower}`] ? Math.ceil(amount * 0.7) : amount;
    applyDamage(game, resolution, attacker.seat, defender.seat, target.targetTower, amount, "Distributed Assault");
    messages.push(`Successful on ${defender.nationName} ${target.targetTower}: ${finalDamage} damage`);
  });
  addPlayerResult(resolution, attacker.seat, "attack", messages.join(" | "), "Distributed Assault");
}

function resolveIntel(game, submissions, resolution) {
  resolution.intel.forEach((action) => {
    const source = getNation(game, action.seat);
    const target = getNation(game, action.targetSeat);
    if (!source || !target) return;
    if (resolution.signalJams.has(target.seat)) {
      addPlayerResult(resolution, source.seat, "intel", "Failure: Signal jammed", action.type);
      return;
    }
    if (action.type === "Deep Surveillance" && action.targetTower) {
      const character = target.towers[action.targetTower].character;
      source.intel.push(`${target.nationName} ${action.targetTower}: ${character}`);
      addPlayerResult(resolution, source.seat, "intel", `Successful on ${action.targetTower}: ${character}`, "Deep Surveillance");
    }
    if (action.type === "Identity Check" && action.guess) {
      const tower = TOWERS.find((towerName) => target.towers[towerName].character === action.guess);
      addPlayerResult(resolution, source.seat, "intel", tower ? `Successful: ${action.guess} is at ${tower}` : `Successful: ${action.guess} not found`, "Identity Check");
    }
    if (action.type === "Move Check") {
      const submission = submissions.find((entry) => entry.seat === target.seat);
      const visibleMoves = (submission.actions || []).map((move) => move.type).join(", ") || "No actions";
      addPlayerResult(resolution, source.seat, "intel", `Successful: ${visibleMoves}`, "Move Check");
    }
  });
}

function decayTreaties(game) {
  game.treaties.forEach((treaty) => {
    if (!treaty.active) return;
    treaty.remaining -= 1;
    if (treaty.remaining <= 0) treaty.active = false;
  });
}

function awardDayGold(game, resolution, topPlayers) {
  const highestHealth = Math.max(...game.players.map(totalHealth));
  const lowestHealth = Math.min(...game.players.map(totalHealth));
  const highestPlayers = game.players.filter((player) => totalHealth(player) === highestHealth);
  const lowestPlayers = game.players.filter((player) => totalHealth(player) === lowestHealth);
  const highestAward = Math.ceil(50 / highestPlayers.length);
  const winAward = Math.ceil(50 / topPlayers.length);
  const lowestAward = Math.ceil(100 / lowestPlayers.length);

  highestPlayers.forEach((player) => {
    player.gold += highestAward;
    addPlayerResult(resolution, player.seat, "economy", `Highest combined health +${highestAward} gold`);
  });
  topPlayers.forEach((player) => {
    player.gold += winAward;
    addPlayerResult(resolution, player.seat, "economy", `Day winner bonus +${winAward} gold`);
  });
  lowestPlayers.forEach((player) => {
    player.gold += lowestAward;
    addPlayerResult(resolution, player.seat, "economy", `Lowest combined health +${lowestAward} gold`);
  });
  game.players.filter((player) => resolution.damageTaken[player.seat] === 0).forEach((player) => {
    player.gold += 25;
    addPlayerResult(resolution, player.seat, "economy", "No damage taken +25 gold");
  });
}

function scoreDay(game, resolution, resolvingDay) {
  const ranking = [...game.players].sort((a, b) => compareDayRanking(a, b, resolution));
  if (ranking.length === 0) {
    return;
  }
  const topPlayers = ranking.filter((player) => compareDayRanking(player, ranking[0], resolution) === 0);
  const splitPoints = 50 / topPlayers.length;
  topPlayers.forEach((player) => {
    player.score += splitPoints;
  });
  game.players.forEach((player) => {
    const text = topPlayers.length === 1
      ? `${topPlayers[0].nationName} won Day ${resolvingDay}`
      : `${topPlayers.map((topPlayer) => topPlayer.nationName).join(", ")} tied and split Day ${resolvingDay}`;
    addPlayerResult(resolution, player.seat, "summary", text);
  });
  awardDayGold(game, resolution, topPlayers);
}

function finalizeLogs(game, resolution, resolvingDay) {
  game.players.forEach((player) => {
    const result = resolution.playerResults[player.seat] || { economy: [], decision: [], jamming: [], defense: [], attack: [], intel: [], summary: [] };
    const dayLog = [];
    result.economy.forEach((text) => dayLog.push(`Economy: ${text}`));
    result.decision.forEach((entry) => dayLog.push(`National Decision: ${entry.label || "Decision"} - ${entry.text || entry}`));
    result.jamming.forEach((entry, index) => dayLog.push(`${entry.label || `Jamming ${index + 1}`}: ${entry.text || entry}`));
    result.defense.forEach((entry, index) => dayLog.push(`${entry.label || `Defense ${index + 1}`}: ${entry.text || entry}`));
    result.attack.forEach((entry, index) => dayLog.push(`${entry.label || `Attack ${index + 1}`}: ${entry.text || entry}`));
    result.intel.forEach((entry, index) => dayLog.push(`${entry.label || `Intel ${index + 1}`}: ${entry.text || entry}`));
    const damage = resolution.towerDamageByPlayer[player.seat];
    dayLog.push(`Damage Taken Summary: Parliament ${damage.Parliament}, Base ${damage.Base}, Office ${damage.Office}`);
    result.summary.forEach((text) => dayLog.push(`War Day: ${text}`));
    player.resolutionHistory[resolvingDay] = dayLog;
  });
}

function finishGame(game, forcedWinnerSeat = null, reason = "points") {
  game.finished = true;
  let winner = forcedWinnerSeat !== null ? getNation(game, forcedWinnerSeat) : null;
  if (reason === "points") {
    const healthiest = [...game.players].sort((a, b) => totalHealth(b) - totalHealth(a))[0];
    if (healthiest) {
      healthiest.score += 100;
    }
  }
  if (!winner) {
    winner = [...game.players].sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return totalHealth(b) - totalHealth(a);
    })[0];
  }
  if (winner) {
    if (reason === "points") {
      winner.score += 100;
    }
    game.winnerSeat = winner.seat;
    game.winReason = reason;
  }
}

module.exports = {
  TOWERS,
  CHARACTER_POOL,
  ATTACK_ACTIONS,
  DEFENSE_ACTIONS,
  INTEL_ACTIONS,
  NATIONAL_DECISIONS,
  createGame,
  createLobby,
  getPlayerRecord,
  getNation,
  joinLobby,
  leaveLobby,
  setCharacters,
  forfeitGame,
  buildPlayerSnapshot,
  submitTurn,
  buildBotSubmission,
  everyoneSubmitted,
  resolveDay,
};
