const state = {
  lobbyId: "",
  token: "",
  inviteLink: "",
  pollHandle: null,
  snapshot: null,
  selectedLogDay: null,
  pendingSnapshot: null,
  suppressRenderWhileEditing: false,
  setupDraft: {
    Parliament: "",
    Base: "",
    Office: "",
  },
  turnDraft: null,
  turnUi: {
    selectedCategory: "attack",
    pending: null,
    popup: null,
  },
  lastSeenDisplayDay: null,
  tutorial: {
    active: false,
    step: 0,
  },
  practiceMode: "",
};

const TUTORIAL_STEPS = {
  1: {
    title: "Choose Characters",
    text: "Choose the character you want to have for each tower. Make sure to choose wisely since your opponents will be trying to guess these! Click next to continue.",
    targetSelectors: ["#setup-panel"],
    nextLabel: "Next",
    allowsNext: true,
  },
  2: {
    title: "Lock In Characters",
    text: "Once you have chosen your characters make sure to lock them in!",
    targetSelectors: ["#ready-button"],
    allowsNext: false,
  },
  3: {
    title: "Your Towers",
    text: "These are your towers, the health of each of these towers will display and update each time they take damage.",
    targetSelectors: [".arena-nation.is-self .arena-tower"],
    nextLabel: "Next",
    allowsNext: true,
  },
  4: {
    title: "Enemy Towers",
    text: "These are your enemy towers. Only a status of Alive or Destroyed will display, you will not know the health of their towers.",
    targetSelectors: [".arena-nation:not(.is-self) .arena-tower"],
    nextLabel: "Next",
    allowsNext: true,
  },
  5: {
    title: "National Decisions",
    text: "These are your National Decisions. For each round your Office Tower is alive you may choose one national decision! Make sure to protect your office!",
    targetSelectors: ["[data-category=\"decision\"]", ".arena-side .arena-sidecard:first-child", ".move-tray"],
    nextLabel: "Next",
    allowsNext: true,
  },
  6: {
    title: "Military Actions",
    text: "These are your military actions. They are separated into 4 categories: Intel, Jamming, Attack, Defense. You can select 3 military actions each turn as long as your base is alive! If your base dies you can only select 2 actions! Select Attack to continue.",
    targetSelectors: ["[data-category=\"intel\"]", "[data-category=\"jamming\"]", "[data-category=\"attack\"]", "[data-category=\"defense\"]"],
    allowsNext: false,
  },
  7: {
    title: "Attack Moves",
    text: "Attacks are how you deal damage to the enemy. Select Target Strike to continue.",
    targetSelectors: ["[data-move=\"Target Strike\"]"],
    allowsNext: false,
  },
  8: {
    title: "Choose A Target",
    text: "Select an enemy base to target with your attack.",
    targetSelectors: [".arena-nation:not(.is-self) [data-tower-name=\"Base\"]"],
    allowsNext: false,
  },
  9: {
    title: "Guess The Character",
    text: "Remember how you selected characters for your towers before the game started? If you guess the character the enemy selected for this tower Target Strike will deal double damage! Try guessing the character.",
    targetSelectors: [".arena-popup"],
    allowsNext: false,
  },
  10: {
    title: "Submit Your Turn",
    text: "When you have finished all your actions you must submit your turn.",
    targetSelectors: ["[data-submit-turn=\"1\"]"],
    allowsNext: false,
  },
  11: {
    title: "Resolution Log",
    text: "This is how you can tell what happened on the previous turn. It will show the outcome of your actions and the damage dealt to your towers, but it won't show the moves of your enemies. That's for you to figure out!",
    targetSelectors: ["#log-panel"],
    nextLabel: "Next",
    allowsNext: true,
  },
  12: {
    title: "Move Guide",
    text: "Select Move Guide to see a description of each move you can make!",
    targetSelectors: ["#move-guide-button"],
    allowsNext: false,
  },
  13: {
    title: "Tutorial Complete",
    text: "You have completed the tutorial! Try finishing the game and defeat your enemy, good luck!!",
    targetSelectors: ["#move-guide-modal .modal-card"],
    nextLabel: "Finish Tutorial",
    allowsNext: true,
  },
};

const JAMMING_ACTIONS = ["Sabotage", "Signal Jam", "Interception", "Counter"];
const CORE_DEFENSE_ACTIONS = ["Fortify", "Repair", "Evacuation"];
const NATION_COLORS = ["azure", "verdant", "amber", "crimson"];
const MOVE_COSTS = {
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
  "HP Check": 40,
  "Move Check": 60,
  "War Mobilization": 0,
  "Strategic Reserve": 0,
  "Full Exposure": 0,
  "Priority Target": 30,
  "Leader's Intervention": 65,
  "Total Mobilization": 150,
  "Expanded Command": 70,
};

function resetTurnUi() {
  state.turnUi = {
    selectedCategory: "attack",
    pending: null,
    popup: null,
  };
}

const moveDescriptions = {
  Strike: "30 gold. Deal 30 damage to one target tower.",
  "Target Strike": "40 gold. Deal 40 damage, or 80 if you correctly guess that tower's character.",
  "Siege Operation": "80 gold. Set up a siege for next day.",
  "Coordinated Assault": "45 gold. Stronger follow-up if you attacked that tower last round.",
  "Distributed Assault": "50 gold. Hit 3 separate towers with optional guesses.",
  Fortify: "45 gold. One tower takes reduced damage.",
  Repair: "30 gold. Restore 40 HP.",
  Evacuation: "70 gold. A tower survives at 1 HP if it would be destroyed.",
  Sabotage: "50 gold. Cancels one incoming siege.",
  "Signal Jam": "40 gold. Blocks intel against your nation.",
  Interception: "50 gold. Stop predicted attacks from one nation.",
  Counter: "70 gold. Stops the first attack and returns 60 damage.",
  "Deep Surveillance": "100 gold. Learn a tower character.",
  "HP Check": "40 gold. Reveal the current HP of one selected enemy tower.",
  "Move Check": "60 gold. Learn all moves chosen by a nation.",
  "War Mobilization": "Free. Gain one extra action this day.",
  "Strategic Reserve": "Free. Gain 50 gold immediately.",
  "Full Exposure": "Free. Guess all 3 enemy tower characters for 200 gold.",
  "Priority Target": "30 gold. Your attacks gain +15 damage against one tower.",
  "Leader's Intervention": "65 gold. One chosen move from one nation fails.",
  "Total Mobilization": "150 gold. Remove repeat-move limits permanently.",
  "Expanded Command": "70 gold. Remove the action-count cap this day.",
};

const el = {
  heroPanel: document.getElementById("hero-panel"),
  heroStatus: document.getElementById("hero-status"),
  heroLobby: document.getElementById("hero-lobby"),
  landingPanel: document.getElementById("landing-panel"),
  lobbyPanel: document.getElementById("lobby-panel"),
  gamePanel: document.getElementById("game-panel"),
  logPanel: document.getElementById("log-panel"),
  rulesPanel: document.getElementById("rules-panel"),
  createName: document.getElementById("create-name"),
  createSize: document.getElementById("create-size"),
  joinName: document.getElementById("join-name"),
  joinCode: document.getElementById("join-code"),
  createLobbyButton: document.getElementById("create-lobby-button"),
  practiceButton: document.getElementById("practice-button"),
  joinLobbyButton: document.getElementById("join-lobby-button"),
  inviteLink: document.getElementById("invite-link"),
  copyLinkButton: document.getElementById("copy-link-button"),
  leaveLobbyButton: document.getElementById("leave-lobby-button"),
  lobbyRoster: document.getElementById("lobby-roster"),
  setupPanel: document.getElementById("setup-panel"),
  setupGrid: document.getElementById("setup-grid"),
  readyButton: document.getElementById("ready-button"),
  turnHeading: document.getElementById("turn-heading"),
  statusBanner: document.getElementById("status-banner"),
  scoreboard: document.getElementById("scoreboard"),
  playerForm: document.getElementById("player-form"),
  forfeitButton: document.getElementById("forfeit-button"),
  leaveMatchButton: document.getElementById("leave-match-button"),
  submitTurnButton: document.getElementById("submit-turn-button"),
  logTabs: document.getElementById("log-tabs"),
  globalLog: document.getElementById("global-log"),
  chatLog: document.getElementById("chat-log"),
  chatInput: document.getElementById("chat-input"),
  chatSendButton: document.getElementById("chat-send-button"),
  moveGuideButton: document.getElementById("move-guide-button"),
  moveGuideModal: document.getElementById("move-guide-modal"),
  moveGuideClose: document.getElementById("move-guide-close"),
  moveGuideDismiss: document.getElementById("move-guide-dismiss"),
  moveGuideContent: document.getElementById("move-guide-content"),
  practiceModal: document.getElementById("practice-modal"),
  practiceClose: document.getElementById("practice-close"),
  practiceTutorialButton: document.getElementById("practice-tutorial-button"),
  practiceRegularButton: document.getElementById("practice-regular-button"),
  tutorialOverlay: document.getElementById("tutorial-overlay"),
  tutorialStepLabel: document.getElementById("tutorial-step-label"),
  tutorialTitle: document.getElementById("tutorial-title"),
  tutorialText: document.getElementById("tutorial-text"),
  tutorialNextButton: document.getElementById("tutorial-next-button"),
  warPhasePopup: document.getElementById("war-phase-popup"),
  warPhasePopupText: document.getElementById("war-phase-popup-text"),
  warPhasePopupButton: document.getElementById("war-phase-popup-button"),
};

function saveSession() {
  localStorage.setItem("art-of-war-session", JSON.stringify({ lobbyId: state.lobbyId, token: state.token }));
}

function getTutorialStepConfig() {
  return TUTORIAL_STEPS[state.tutorial.step] || null;
}

function setTutorialStep(step) {
  state.tutorial.active = step > 0;
  state.tutorial.step = step;
}

function tutorialBlocksInteraction() {
  return state.tutorial.active;
}

function tutorialAllows(action, detail = "") {
  if (!tutorialBlocksInteraction()) return true;
  const step = state.tutorial.step;
  if (action === "tutorial-next") {
    return Boolean(getTutorialStepConfig()?.allowsNext);
  }
  if (step === 1) return action === "setup-select";
  if (step === 2) return action === "ready";
  if (step === 3 || step === 4 || step === 5 || step === 11 || step === 13) return false;
  if (step === 6) return action === "category" && detail === "attack";
  if (step === 7) return action === "move" && detail === "Target Strike";
  if (step === 8) return action === "tower" && detail === "Base";
  if (step === 9) return action === "popup-submit" && detail === "guessAfterTowerAction";
  if (step === 10) return action === "submit-turn";
  if (step === 12) return action === "move-guide";
  return true;
}

function isTutorialCharacterSelectionValid() {
  const values = [
    state.setupDraft.Parliament || document.getElementById("setup-Parliament")?.value || "",
    state.setupDraft.Base || document.getElementById("setup-Base")?.value || "",
    state.setupDraft.Office || document.getElementById("setup-Office")?.value || "",
  ].filter(Boolean);
  return values.length === 3 && new Set(values).size === 3;
}

function getActiveMoveSelection() {
  return state.turnUi.pending?.moveType || state.turnUi.popup?.moveType || "";
}

function applyTutorialFocus() {
  document.querySelectorAll(".tutorial-focus").forEach((node) => node.classList.remove("tutorial-focus"));
  if (!tutorialBlocksInteraction()) return;
  const config = getTutorialStepConfig();
  let firstTarget = null;
  (config?.targetSelectors || []).forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      if (!firstTarget) firstTarget = node;
      node.classList.add("tutorial-focus");
    });
  });
  firstTarget?.scrollIntoView?.({ block: "center", behavior: "smooth" });
}

function renderTutorialOverlay() {
  if (!tutorialBlocksInteraction()) {
    document.body.classList.remove("tutorial-active");
    el.tutorialOverlay.classList.add("hidden");
    applyTutorialFocus();
    return;
  }
  const config = getTutorialStepConfig();
  if (!config) return;
  document.body.classList.add("tutorial-active");
  el.tutorialOverlay.classList.remove("hidden");
  el.tutorialStepLabel.textContent = "Tutorial";
  el.tutorialTitle.textContent = config.title;
  el.tutorialText.textContent = config.text;
  el.tutorialNextButton.textContent = config.nextLabel || "Next";
  el.tutorialNextButton.classList.toggle("hidden", !config.allowsNext);
  el.tutorialNextButton.disabled = state.tutorial.step === 1 && !isTutorialCharacterSelectionValid();
  applyTutorialFocus();
}

function advanceTutorial() {
  if (!tutorialBlocksInteraction()) return;
  if (!tutorialAllows("tutorial-next")) return;
  if (state.tutorial.step === 1 && !isTutorialCharacterSelectionValid()) return;
  if (state.tutorial.step === 1) setTutorialStep(2);
  else if (state.tutorial.step === 3) setTutorialStep(4);
  else if (state.tutorial.step === 4) {
    state.turnUi.selectedCategory = "decision";
    setTutorialStep(5);
  } else if (state.tutorial.step === 5) setTutorialStep(6);
  else if (state.tutorial.step === 11) setTutorialStep(12);
  else if (state.tutorial.step === 13) {
    setTutorialStep(0);
    closeMoveGuide();
  }
  render();
}

function loadSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem("art-of-war-session") || "{}");
    state.lobbyId = parsed.lobbyId || new URLSearchParams(window.location.search).get("lobby") || "";
    state.token = parsed.token || "";
  } catch {
    state.lobbyId = new URLSearchParams(window.location.search).get("lobby") || "";
    state.token = "";
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function beginPolling() {
  if (state.pollHandle) clearInterval(state.pollHandle);
  state.pollHandle = setInterval(refreshState, 2000);
}

async function refreshState() {
  if (!state.lobbyId || !state.token) return;
  try {
    const snapshot = await api(`/api/state?lobby=${encodeURIComponent(state.lobbyId)}&token=${encodeURIComponent(state.token)}`);
    if (state.suppressRenderWhileEditing) {
      state.pendingSnapshot = snapshot;
      return;
    }
    applySnapshot(snapshot);
  } catch (error) {
    el.heroStatus.textContent = error.message;
  }
}

function applySnapshot(snapshot) {
  const previousDay = state.snapshot?.game?.displayDay ?? state.lastSeenDisplayDay;
  const wasStarted = state.snapshot?.game?.started;
  if (!state.turnUi) {
    resetTurnUi();
  }
  if (previousDay !== null && snapshot.game.displayDay !== previousDay) {
    resetTurnUi();
  }
  state.snapshot = snapshot;
  state.pendingSnapshot = null;
  state.inviteLink = `${window.location.origin}/?lobby=${snapshot.lobbyId}`;
  if (wasStarted && previousDay !== null && snapshot.game.displayDay > previousDay) {
    state.selectedLogDay = null;
    showWarPhasePopup(snapshot.game.lastWarPhaseWinnerText || "");
  }
  state.lastSeenDisplayDay = snapshot.game.displayDay;
  render();
}

function showWarPhasePopup(text) {
  if (!text || !el.warPhasePopup || !el.warPhasePopupText) return;
  el.warPhasePopupText.textContent = text;
  el.warPhasePopup.classList.remove("hidden");
}

function dismissWarPhasePopup() {
  el.warPhasePopup.classList.add("hidden");
}

function renderRoster(snapshot) {
  el.lobbyRoster.innerHTML = snapshot.roster
    .map((player) => `
      <div class="score-card">
        <h3>${player.displayName}</h3>
        <p class="meta-text">${player.nationName}${player.isBot ? " · AI Bot" : ""}</p>
      </div>
    `)
    .join("");
}

function renderSetup(snapshot) {
  const you = snapshot.game.you;
  el.setupPanel.classList.toggle("hidden", snapshot.game.started);
  if (snapshot.game.started) return;
  el.readyButton.disabled = you.ready;
  el.readyButton.textContent = you.ready ? "Characters Locked ✓" : "Lock In Characters";
  const draft = {
    Parliament: state.setupDraft.Parliament || you.towers.Parliament.character || snapshot.constants.characters[0],
    Base: state.setupDraft.Base || you.towers.Base.character || snapshot.constants.characters[1] || snapshot.constants.characters[0],
    Office: state.setupDraft.Office || you.towers.Office.character || snapshot.constants.characters[2] || snapshot.constants.characters[0],
  };
  el.setupGrid.innerHTML = `
    <div class="player-card">
      <h3>${you.nationName}</h3>
      <div class="tower-grid">
        ${snapshot.constants.towers.map((tower) => `
          <div class="tower-box">
            <label class="compact-label" for="setup-${tower}">${tower}</label>
            <select id="setup-${tower}">
              ${snapshot.constants.characters.map((character) => `<option value="${character}" ${draft[tower] === character ? "selected" : ""}>${character}</option>`).join("")}
            </select>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  snapshot.constants.towers.forEach((tower) => {
    const select = document.getElementById(`setup-${tower}`);
    select.disabled = you.ready || !tutorialAllows("setup-select");
    select.addEventListener("change", () => {
      if (!tutorialAllows("setup-select")) return;
      state.setupDraft[tower] = select.value;
    });
  });
}

function nationOptions(snapshot, includeEmpty = true, selectedValue = "") {
  const currentSeat = snapshot.game.playerSeat;
  const options = snapshot.game.nations
    .filter((nation) => nation.seat !== currentSeat)
    .map((nation) => `<option value="${nation.seat}" ${String(selectedValue) === String(nation.seat) ? "selected" : ""}>${nation.nationName}</option>`);
  return `${includeEmpty ? `<option value="" ${selectedValue === "" ? "selected" : ""}>None</option>` : ""}${options.join("")}`;
}

function fullExposureNationOptions(snapshot, selectedValue = "") {
  const currentSeat = snapshot.game.playerSeat;
  const used = snapshot.game.you.fullExposureUsed || {};
  const options = snapshot.game.nations
    .filter((nation) => nation.seat !== currentSeat)
    .map((nation) => `<option value="${nation.seat}" ${used[nation.seat] ? "disabled" : ""} ${String(selectedValue) === String(nation.seat) ? "selected" : ""}>${nation.nationName}${used[nation.seat] ? " (Used)" : ""}</option>`);
  return `<option value="" ${selectedValue === "" ? "selected" : ""}>None</option>${options.join("")}`;
}

function getCommanderName(snapshot, seat) {
  return snapshot.roster.find((entry) => entry.seat === seat)?.displayName || snapshot.game.nations.find((entry) => entry.seat === seat)?.nationName || "Unknown Commander";
}

function towerOptions(selectedValue = "") {
  return `<option value="" ${selectedValue === "" ? "selected" : ""}>None</option><option value="Parliament" ${selectedValue === "Parliament" ? "selected" : ""}>Parliament</option><option value="Base" ${selectedValue === "Base" ? "selected" : ""}>Base</option><option value="Office" ${selectedValue === "Office" ? "selected" : ""}>Office</option>`;
}

function characterOptions(optionalLabel = "None", selectedValue = "") {
  return `<option value="" ${selectedValue === "" ? "selected" : ""}>${optionalLabel}</option>${state.snapshot.constants.characters.map((character) => `<option value="${character}" ${selectedValue === character ? "selected" : ""}>${character}</option>`).join("")}`;
}

function getUsedActionCount() {
  return state.turnDraft.actions.filter((action) => action.type).length;
}

function getRemainingActionCount(snapshot) {
  return Math.max(0, getAvailableActionLimit(snapshot) - getUsedActionCount());
}

function compactActionDraft(action) {
  return {
    type: action.type,
    targetSeat: action.targetSeat ?? "",
    targetTower: action.targetTower ?? "",
    guess: action.guess ?? "",
    targets: Array.from({ length: 3 }, (_, index) => ({
      targetSeat: action.targets?.[index]?.targetSeat ?? "",
      targetTower: action.targets?.[index]?.targetTower ?? "",
      guess: action.targets?.[index]?.guess ?? "",
    })),
  };
}

function addDraftAction(snapshot, action) {
  const nextIndex = state.turnDraft.actions.findIndex((entry) => !entry.type);
  if (nextIndex === -1 || getRemainingActionCount(snapshot) <= 0) return false;
  state.turnDraft.actions[nextIndex] = compactActionDraft(action);
  return true;
}

function removeDraftAction(index) {
  state.turnDraft.actions.splice(index, 1);
  state.turnDraft.actions.push(createEmptyActionDraft());
}

function clearDecisionDraft() {
  state.turnDraft.decision = {
    type: "",
    targetSeat: "",
    payload: "",
    guesses: { Parliament: "", Base: "", Office: "" },
  };
}

function getMoveCategory(type) {
  if (state.snapshot.constants.nationalDecisions.includes(type)) return "decision";
  if (JAMMING_ACTIONS.includes(type)) return "jamming";
  if (CORE_DEFENSE_ACTIONS.includes(type)) return "defense";
  if (state.snapshot.constants.attackActions.includes(type)) return "attack";
  if (state.snapshot.constants.intelActions.includes(type)) return "intel";
  return "";
}

function getMovesForCategory(snapshot, category) {
  if (category === "decision") return snapshot.constants.nationalDecisions;
  if (category === "attack") return snapshot.constants.attackActions;
  if (category === "intel") return snapshot.constants.intelActions;
  if (category === "jamming") return snapshot.game.playerCount === 2 ? JAMMING_ACTIONS.filter((action) => action !== "Interception") : JAMMING_ACTIONS;
  if (category === "defense") return CORE_DEFENSE_ACTIONS;
  return [];
}

function getArenaSeatLayout(playerCount, compact) {
  const layoutsWide = {
    2: [
      { x: 50, y: 22 },
      { x: 50, y: 70 },
    ],
    3: [
      { x: 50, y: 20 },
      { x: 23, y: 58 },
      { x: 77, y: 58 },
    ],
    4: [
      { x: 50, y: 20 },
      { x: 80, y: 42 },
      { x: 50, y: 72 },
      { x: 20, y: 42 },
    ],
  };
  const layoutsCompact = {
    2: [
      { x: 50, y: 26 },
      { x: 50, y: 74 },
    ],
    3: [
      { x: 50, y: 18 },
      { x: 16, y: 64 },
      { x: 84, y: 64 },
    ],
    4: [
      { x: 50, y: 16 },
      { x: 88, y: 40 },
      { x: 50, y: 78 },
      { x: 12, y: 40 },
    ],
  };
  const layouts = compact ? layoutsCompact : layoutsWide;
  return layouts[playerCount] || layouts[4];
}

function getRotatedNations(snapshot) {
  const currentSeat = snapshot.game.playerSeat;
  return [...snapshot.game.nations].sort((left, right) => {
    const leftOffset = (left.seat - currentSeat + snapshot.game.playerCount) % snapshot.game.playerCount;
    const rightOffset = (right.seat - currentSeat + snapshot.game.playerCount) % snapshot.game.playerCount;
    return leftOffset - rightOffset;
  });
}

function getTowerTotalHp(towers) {
  return Object.values(towers).reduce((sum, tower) => sum + tower.hp, 0);
}

function getTowerBadgeText(snapshot, nation, towerName, data) {
  if (nation.seat === snapshot.game.playerSeat) {
    return `${data.hp} HP`;
  }
  return data.hp > 0 ? "Alive" : "Destroyed";
}

function hasIncomingSiege(snapshot, seat, towerName) {
  const incoming = snapshot.game.you.incomingSieges?.some((siege) => siege.targetTower === towerName && seat === snapshot.game.playerSeat);
  const outgoing = snapshot.game.you.outgoingSieges?.some((siege) => siege.targetSeat === seat && siege.targetTower === towerName);
  return incoming || outgoing;
}

function getSiegeThreatTitle(snapshot, seat, towerName) {
  const incoming = snapshot.game.you.incomingSieges?.some((siege) => siege.targetTower === towerName && seat === snapshot.game.playerSeat);
  if (incoming) return "Incoming siege";
  const outgoing = snapshot.game.you.outgoingSieges?.some((siege) => siege.targetSeat === seat && siege.targetTower === towerName);
  if (outgoing) return "Outgoing siege";
  return "Siege";
}

function getKnownTowerCharacter(snapshot, seat, towerName) {
  return snapshot.game.you.knownTowerCharacters?.[seat]?.[towerName] || "";
}

function getDamageMarker(snapshot, seat, towerName) {
  const totalDamage = (snapshot.game.you.damageMarkers || [])
    .filter((marker) => marker.targetSeat === seat && marker.targetTower === towerName)
    .reduce((sum, marker) => sum + marker.damage, 0);
  return totalDamage > 0 ? [{ damage: totalDamage }] : [];
}

function getPendingInstruction(snapshot) {
  if (state.turnUi.popup?.type === "intervention") {
    return "Leader's Intervention selected. Choose one nation and the move you want to block.";
  }
  if (state.turnUi.popup?.type === "fullExposure") {
    return "Full Exposure selected. Choose one nation, then guess Parliament, Base, and Office.";
  }
  if (state.turnUi.popup?.type === "guessAfterTowerAction") {
    return `Choose the character guess for ${state.turnUi.popup.targetTower}.`;
  }
  if (state.turnUi.popup?.type === "hpCheck") {
    return "HP Check selected. Choose one enemy tower to reveal its current HP.";
  }
  if (state.turnUi.popup?.type === "nationOnlyAction") {
    return `${state.turnUi.popup.moveType} selected. Choose one target nation.`;
  }
  const pending = state.turnUi.pending;
  if (!pending) {
    if (state.turnUi.selectedCategory === "decision") {
      return state.turnDraft.decision.type
        ? `National Decision locked: ${state.turnDraft.decision.type}. You may choose only one national decision this round.`
        : "Choose one national decision, or switch categories to queue your normal actions.";
    }
    return `Choose a move, then complete any required targeting. ${getRemainingActionCount(snapshot)} action(s) remaining.`;
  }
  if (pending.kind === "towerAction") {
    return pending.scope === "self"
      ? `Select one of your towers for ${pending.moveType}.`
      : `Select a target tower for ${pending.moveType}.`;
  }
  if (pending.kind === "distributed") {
    return `Select target ${pending.targets.length + 1} of 3 for Distributed Assault.`;
  }
  if (pending.kind === "priorityDecision") {
    return "Select the enemy tower for Priority Target.";
  }
  return "Complete the active selection.";
}

function isMoveAlreadyUsed(snapshot, moveType) {
  if (snapshot.game.you.totalMobilization || state.turnDraft?.decision?.type === "Total Mobilization") return false;
  return state.turnDraft.actions.some((action) => action.type === moveType);
}

function isTowerSelectable(snapshot, nation, towerName, towerData) {
  const pending = state.turnUi.pending;
  if (!pending || towerData.hp <= 0) return false;
  if (pending.kind === "priorityDecision") {
    return nation.seat !== snapshot.game.playerSeat;
  }
  if (pending.kind === "towerAction") {
    return pending.scope === "self"
      ? nation.seat === snapshot.game.playerSeat
      : nation.seat !== snapshot.game.playerSeat;
  }
  if (pending.kind === "distributed") {
    if (nation.seat === snapshot.game.playerSeat) return false;
    const pendingPopupMatch = state.turnUi.popup?.type === "distributedGuess"
      && Number(state.turnUi.popup.pendingTargetSeat) === nation.seat
      && state.turnUi.popup.pendingTargetTower === towerName;
    return !pending.targets.some((target) => target.targetSeat === nation.seat && target.targetTower === towerName) && !pendingPopupMatch;
  }
  return false;
}

function renderOrdersQueue(snapshot, turnLocked) {
  const actionEntries = state.turnDraft.actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => action.type);
  const actions = actionEntries.map(({ action, index }) => `
    <div class="order-pill">
      <div>
        <strong>${action.type}</strong>
        <span>${describeQueuedAction(snapshot, action)}</span>
      </div>
      ${turnLocked ? "" : `<button type="button" class="order-remove" data-remove-action="${index}">Clear</button>`}
    </div>
  `).join("");
  return actions
    ? `<div class="orders-queue">${actions}</div>`
    : `<div class="meta-text">No orders queued yet.</div>`;
}

function describeDecision(snapshot) {
  const decision = state.turnDraft.decision;
  if (!decision.type) return "No national decision selected.";
  if (decision.type === "Priority Target" && decision.targetSeat !== "" && decision.payload) {
    const nation = snapshot.game.nations.find((entry) => entry.seat === Number(decision.targetSeat));
    return `${nation?.nationName || "Unknown"} ${decision.payload}`;
  }
  if (decision.type === "Leader's Intervention" && decision.targetSeat !== "" && decision.payload) {
    const nation = snapshot.game.nations.find((entry) => entry.seat === Number(decision.targetSeat));
    return `${nation?.nationName || "Unknown"} - block ${decision.payload}`;
  }
  if (decision.type === "Full Exposure" && decision.targetSeat !== "") {
    const nation = snapshot.game.nations.find((entry) => entry.seat === Number(decision.targetSeat));
    return `${nation?.nationName || "Unknown"} locked in with 3 tower guesses`;
  }
  return "Ready";
}

function renderDecisionPanel(snapshot, turnLocked) {
  const hasDecision = Boolean(state.turnDraft.decision.type);
  return `
    <div class="arena-sidecard war-panel arena-national-decision ${hasDecision ? "decision-card-active" : ""}">
      <div class="sidecard-header war-panel-header">
        <div>
          <p class="war-panel-kicker">Strategic authority</p>
          <h3>National Decision</h3>
        </div>
        <span class="meta-text war-panel-badge">${hasDecision ? "Locked this round" : "1 available"}</span>
      </div>
      ${hasDecision
        ? `
          <div class="order-pill order-pill-decision">
            <div>
              <strong>${state.turnDraft.decision.type}</strong>
              <span>${describeDecision(snapshot)}</span>
            </div>
            ${turnLocked ? "" : '<button type="button" class="order-remove" data-clear-decision="1">Clear</button>'}
          </div>
        `
        : '<div class="meta-text">Choose one national decision from the move tray. It does not use one of your normal actions.</div>'}
    </div>
  `;
}

function describeQueuedAction(snapshot, action) {
  if (action.type === "Distributed Assault") {
    return action.targets.filter((target) => target.targetSeat !== "").map((target) => {
      const nation = snapshot.game.nations.find((entry) => entry.seat === Number(target.targetSeat));
      return `${nation?.nationName || "Unknown"} ${target.targetTower}`;
    }).join(" | ");
  }
  if (action.targetSeat !== "" && action.targetTower) {
    const nation = snapshot.game.nations.find((entry) => entry.seat === Number(action.targetSeat));
    return `${nation?.nationName || "Unknown"} ${action.targetTower}`;
  }
  if (action.targetTower) return action.targetTower;
  if (action.targetSeat !== "") {
    const nation = snapshot.game.nations.find((entry) => entry.seat === Number(action.targetSeat));
    return nation?.nationName || "Unknown";
  }
  return "Ready";
}

const TOWER_CREST = {
  Parliament: "🏛️",
  Base: "🏰",
  Office: "🏢",
};

function renderArena(snapshot) {
  const compact =
    typeof window !== "undefined" && window.innerWidth > 0 && window.innerWidth < 900;
  const layout = getArenaSeatLayout(snapshot.game.playerCount, compact);
  const maxHp = snapshot.game.towerMaxHp;
  return getRotatedNations(snapshot).map((nation, index) => {
    const position = layout[index] || layout[layout.length - 1];
    const colorClass = `nation-${NATION_COLORS[nation.seat % NATION_COLORS.length]}`;
    const isSelfNation = nation.seat === snapshot.game.playerSeat;
    return `
      <div class="arena-nation ${isSelfNation ? "is-self" : ""}" style="left:${position.x}%;top:${position.y}%;">
        <div class="arena-nation-name">${nation.nationName}</div>
        <div class="arena-cluster ${colorClass}">
          ${["Parliament", "Base", "Office"].map((towerName) => {
            const tower = nation.towers[towerName];
            const selectable = isTowerSelectable(snapshot, nation, towerName, tower);
            const knownCharacter = getKnownTowerCharacter(snapshot, nation.seat, towerName);
            const damageMarkers = getDamageMarker(snapshot, nation.seat, towerName);
            const slug = towerName.toLowerCase();
            const hpPct = Math.max(0, Math.min(100, (tower.hp / maxHp) * 100));
            const obscuredEnemy = !isSelfNation && tower.hp > 0;
            return `
              <button
                type="button"
                class="arena-tower arena-tower--${slug} ${obscuredEnemy ? "arena-tower--obscured" : ""} ${tower.hp <= 0 ? "is-destroyed" : ""} ${selectable ? "is-selectable" : ""}"
                style="--hp-pct: ${obscuredEnemy ? 100 : hpPct};"
                data-tower-seat="${nation.seat}"
                data-tower-name="${towerName}"
                ${selectable ? "" : "disabled"}
              >
                <span class="arena-tower-sheen" aria-hidden="true"></span>
                <span class="arena-tower-frame">
                  <span class="arena-tower-crest" aria-hidden="true">${TOWER_CREST[towerName] || "◆"}</span>
                  <span class="arena-tower-hpbar" role="presentation">
                    <span class="arena-tower-hpfill"></span>
                  </span>
                  <span class="arena-tower-name">${towerName}</span>
                  <span class="arena-tower-meta">${getTowerBadgeText(snapshot, nation, towerName, tower)}</span>
                </span>
                ${knownCharacter ? `<span class="arena-tower-intel">${knownCharacter}</span>` : ""}
                ${hasIncomingSiege(snapshot, nation.seat, towerName) ? `
                  <span class="arena-tower-threat" title="${getSiegeThreatTitle(snapshot, nation.seat, towerName)}">
                    <span class="arena-tower-threat-icon"></span>
                    <span>Siege</span>
                  </span>
                ` : ""}
                ${damageMarkers.map((damageMarker, markerIndex) => `
                  <span
                    class="arena-damage-burst"
                    style="top:${-10 + (markerIndex * 18)}px;right:${-8 + (markerIndex * 2)}px;"
                    title="${damageMarker.damage} damage dealt"
                  >
                    <span class="arena-damage-emoji">💥</span>
                    <span class="arena-damage-value">${damageMarker.damage}</span>
                  </span>
                `).join("")}
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function renderCategoryDock(snapshot, turnLocked) {
  const remaining = getRemainingActionCount(snapshot);
  const categoryMeta = [
    { key: "decision", label: "National Decision", disabled: turnLocked || Boolean(state.turnDraft.decision.type) },
    { key: "intel", label: "Intel", disabled: turnLocked || remaining === 0 },
    { key: "jamming", label: "Jamming", disabled: turnLocked || remaining === 0 },
    { key: "attack", label: "Attack", disabled: turnLocked || remaining === 0 },
    { key: "defense", label: "Defense", disabled: turnLocked || remaining === 0 },
  ];
  return `
    <div class="arena-dock">
      ${categoryMeta.map((category) => `
        <button
          type="button"
          class="dock-button ${state.turnUi.selectedCategory === category.key ? "is-active" : ""}"
          data-category="${category.key}"
          ${category.disabled ? "disabled" : ""}
        >
          <span>${category.label}</span>
          <strong>${category.key === "decision" ? (state.turnDraft.decision.type ? "Locked" : "Ready") : `${remaining} left`}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

function renderMoveTray(snapshot, turnLocked) {
  const category = state.turnUi.selectedCategory || "attack";
  const moves = getMovesForCategory(snapshot, category);
  const activeMove = getActiveMoveSelection();
  if (!moves.length) {
    return `
    <div class="move-tray move-tray-empty war-panel-inset">
      <p class="move-tray-empty-text">No orders in this category. Try another tab above.</p>
    </div>`;
  }
  return `
    <div class="move-tray war-panel-inset">
      ${moves.map((move) => {
        const disabled = turnLocked
          || (category !== "decision" && getRemainingActionCount(snapshot) === 0)
          || (category === "decision" && Boolean(state.turnDraft.decision.type))
          || (category !== "decision" && isMoveAlreadyUsed(snapshot, move));
        const selected = (category === "decision" && state.turnDraft.decision.type === move) || activeMove === move;
        return `
          <button type="button" class="move-chip ${selected ? "is-selected" : ""}" data-move="${move}" title="${moveDescriptions[move] || ""}" ${disabled ? "disabled" : ""}>
            <span>${move}</span>
            <strong>${MOVE_COSTS[move] === 0 ? "Free" : `${MOVE_COSTS[move]}g`}</strong>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderTreatiesPanel(snapshot, turnLocked) {
  if (snapshot.game.playerCount === 2) {
    return "";
  }
  const you = snapshot.game.you;
  return `
    <div class="arena-sidecard war-panel">
      <div class="sidecard-header war-panel-header">
        <div>
          <p class="war-panel-kicker">Diplomacy</p>
          <h3>Treaties</h3>
        </div>
        <span class="meta-text">Treaties and responses</span>
      </div>
      ${you.activeTreaties.length
        ? `<div class="treaty-list">${you.activeTreaties.map((treaty) => `<div class="treaty-entry">Active with ${treaty.withNation}: ${treaty.remaining} day(s)</div>`).join("")}</div>`
        : `<div class="meta-text">No active treaties.</div>`}
      <div class="diplomacy-row">
        <select id="treaty-target-arena" ${turnLocked ? "disabled" : ""}>${nationOptions(snapshot)}</select>
        <select id="treaty-duration-arena" ${turnLocked ? "disabled" : ""}>
          <option value="1">1 day</option>
          <option value="2">2 days</option>
          <option value="3">3 days</option>
        </select>
      </div>
      ${you.incomingTreaties.map((offer) => `
        <div class="treaty-entry">
          <span>${offer.fromNation} proposed ${offer.duration} day(s)</span>
          <select class="treaty-response-select" data-offer-id="${offer.offerId}" ${turnLocked ? "disabled" : ""}>
            <option value="">No response</option>
            <option value="accept">Accept</option>
            <option value="decline">Decline</option>
          </select>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPopup(snapshot) {
  const popup = state.turnUi.popup;
  if (!popup) return "";
  if (popup.type === "guessAfterTowerAction") {
    return `
      <div class="arena-popup-backdrop"></div>
      <div class="arena-popup">
        <h3>${popup.moveType}</h3>
        <p class="meta-text">Choose the character guess for ${popup.targetTower}.</p>
        <select id="arena-popup-guess">${characterOptions("Select character", popup.guess || "")}</select>
        <div class="popup-actions">
          <button type="button" class="secondary-button" data-popup-cancel="1">Cancel</button>
          <button type="button" class="primary-button" data-popup-submit="guessAfterTowerAction">Confirm</button>
        </div>
      </div>
    `;
  }
  if (popup.type === "nationOnlyAction") {
    return `
      <div class="arena-popup-backdrop"></div>
      <div class="arena-popup">
        <h3>${popup.moveType}</h3>
        <p class="meta-text">Choose a target nation.</p>
        <select id="arena-popup-nation">${nationOptions(snapshot, true, popup.nation || "")}</select>
        <div class="popup-actions">
          <button type="button" class="secondary-button" data-popup-cancel="1">Cancel</button>
          <button type="button" class="primary-button" data-popup-submit="nationOnlyAction">Confirm</button>
        </div>
      </div>
    `;
  }
  if (popup.type === "hpCheck") {
    return `
      <div class="arena-popup-backdrop"></div>
      <div class="arena-popup">
        <h3>HP Check</h3>
        <p class="meta-text">Choose a nation and tower.</p>
        <select id="arena-popup-nation">${nationOptions(snapshot, true, popup.nation || "")}</select>
        <select id="arena-popup-tower">${towerOptions(popup.tower || "")}</select>
        <div class="popup-actions">
          <button type="button" class="secondary-button" data-popup-cancel="1">Cancel</button>
          <button type="button" class="primary-button" data-popup-submit="hpCheck">Confirm</button>
        </div>
      </div>
    `;
  }
  if (popup.type === "distributedGuess") {
    return `
      <div class="arena-popup-backdrop"></div>
      <div class="arena-popup">
        <h3>Distributed Assault</h3>
        <p class="meta-text">Optional guess for target ${popup.targets.length + 1} of 3.</p>
        <select id="arena-popup-guess">${characterOptions("No guess", popup.guess || "")}</select>
        <div class="popup-actions">
          <button type="button" class="secondary-button" data-popup-cancel="distributedGuess">Back</button>
          <button type="button" class="primary-button" data-popup-submit="distributedGuess">Next</button>
        </div>
      </div>
    `;
  }
  if (popup.type === "intervention") {
    return `
      <div class="arena-popup-backdrop"></div>
      <div class="arena-popup">
        <h3>Leader's Intervention</h3>
        <p class="meta-text">Choose a nation and one action to block.</p>
        <select id="arena-popup-nation">${nationOptions(snapshot, true, popup.nation || "")}</select>
        <select id="arena-popup-action">
          <option value="">Select action</option>
          ${[...snapshot.constants.attackActions, ...CORE_DEFENSE_ACTIONS, ...JAMMING_ACTIONS, ...snapshot.constants.intelActions].map((action) => `<option value="${action}" ${popup.action === action ? "selected" : ""}>${action}</option>`).join("")}
        </select>
        <div class="popup-actions">
          <button type="button" class="secondary-button" data-popup-cancel="1">Cancel</button>
          <button type="button" class="primary-button" data-popup-submit="intervention">Confirm</button>
        </div>
      </div>
    `;
  }
  if (popup.type === "fullExposure") {
    return `
      <div class="arena-popup-backdrop"></div>
      <div class="arena-popup">
        <h3>Full Exposure</h3>
        <p class="meta-text">Choose a nation and all three guesses.</p>
        <select id="arena-popup-nation">${fullExposureNationOptions(snapshot, popup.nation || "")}</select>
        ${snapshot.constants.towers.map((tower) => `
          <label class="compact-label" for="arena-popup-${tower}">${tower}</label>
          <select id="arena-popup-${tower}">${characterOptions("Select character", popup.guesses?.[tower] || "")}</select>
        `).join("")}
        <div class="popup-actions">
          <button type="button" class="secondary-button" data-popup-cancel="1">Cancel</button>
          <button type="button" class="primary-button" data-popup-submit="fullExposure">Confirm</button>
        </div>
      </div>
    `;
  }
  return "";
}

function renderGame(snapshot) {
  const you = snapshot.game.you;
  if (!state.turnDraft || state.turnDraft.day !== snapshot.game.displayDay) {
    state.turnDraft = createEmptyTurnDraft(snapshot);
    resetTurnUi();
  }
  const turnLocked = you.lastSubmittedDay === snapshot.game.displayDay;
  el.turnHeading.textContent = `Day ${snapshot.game.displayDay} - ${you.nationName}`;
  const winnerName = snapshot.game.finished && snapshot.game.winnerSeat !== null ? getCommanderName(snapshot, snapshot.game.winnerSeat) : "";
  const winReason = snapshot.game.winReason === "forfeit"
    ? "won by forfeit."
    : snapshot.game.winReason === "conquest"
      ? "won by destroying all enemy towers."
      : "won on points.";
  el.statusBanner.innerHTML = `<span class="meta-text">${snapshot.game.finished ? `${winnerName} ${winReason}` : getPendingInstruction(snapshot)}</span>`;
  el.scoreboard.innerHTML = "";
  el.scoreboard.classList.add("hidden");
  el.submitTurnButton.classList.add("hidden");

  el.playerForm.className = "arena-shell";
  el.playerForm.innerHTML = `
    <section class="arena-board ${turnLocked ? "submitted-card" : ""}">
      <div class="arena-hud">
        <div class="arena-stat left">
          <span>Points | Gold</span>
          <strong>${you.score} | ${you.gold}g</strong>
        </div>
        <div class="arena-title">
          <strong>${you.nationName}</strong>
          <span>${getUsedActionCount()} / ${getAvailableActionLimit(snapshot)} orders used</span>
        </div>
        <div class="arena-stat right">
          <span>Total HP</span>
          <strong>${getTowerTotalHp(you.towers)}</strong>
        </div>
      </div>

      <div class="arena-command-deck">
        <header class="arena-command-deck-head">
          <div>
            <p class="war-panel-kicker">War room</p>
            <h3 class="arena-command-deck-title">Command deck</h3>
          </div>
          <p class="arena-command-deck-hint meta-text">Choose a category, queue moves on the board, then submit.</p>
        </header>
        ${renderCategoryDock(snapshot, turnLocked)}
        ${renderMoveTray(snapshot, turnLocked)}
        <div class="command-actions command-actions-bar">
          <button type="button" class="secondary-button command-bar-btn" data-cancel-selection="1" ${state.turnUi.pending || state.turnUi.popup ? "" : "disabled"}>Cancel Selection</button>
          ${snapshot.game.finished ? '<button type="button" class="secondary-button command-bar-btn" data-leave-match="1">Leave Match</button>' : ""}
          <button type="button" class="primary-button command-bar-btn command-bar-submit" data-submit-turn="1" ${turnLocked || snapshot.game.finished ? "disabled" : ""}>${snapshot.game.finished ? "Match Complete" : turnLocked ? "Turn Submitted" : "Submit Turn"}</button>
        </div>
      </div>

      <div class="arena-workspace">
        <div class="arena-field">
          ${renderArena(snapshot)}
        </div>
        <aside class="arena-side">
          ${renderDecisionPanel(snapshot, turnLocked)}
          <div class="arena-sidecard war-panel arena-queue-card">
            <div class="sidecard-header war-panel-header">
              <div>
                <p class="war-panel-kicker">Battle plan</p>
                <h3>Queued Orders</h3>
              </div>
              <span class="meta-text war-panel-badge">${getRemainingActionCount(snapshot)} left</span>
            </div>
            ${renderOrdersQueue(snapshot, turnLocked)}
          </div>
        </aside>
      </div>

      <div class="arena-treaties-row ${snapshot.game.playerCount === 2 ? "hidden" : ""}">
        ${renderTreatiesPanel(snapshot, turnLocked)}
      </div>

      ${renderPopup(snapshot)}
    </section>
  `;

  bindArenaEvents(snapshot, turnLocked);
}

function bindArenaEvents(snapshot, turnLocked) {
  document.getElementById("treaty-target-arena")?.addEventListener("change", (event) => {
    state.turnDraft.treaty.targetSeat = event.target.value;
  });
  document.getElementById("treaty-duration-arena")?.addEventListener("change", (event) => {
    state.turnDraft.treaty.duration = event.target.value;
  });
  el.playerForm.querySelectorAll(".treaty-response-select").forEach((select) => {
    select.addEventListener("change", (event) => {
      state.turnDraft.treatyResponses[event.target.dataset.offerId] = event.target.value;
    });
  });
  el.playerForm.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.turnUi.popup) return;
      if (!tutorialAllows("category", button.dataset.category)) return;
      state.turnUi.selectedCategory = button.dataset.category;
      state.turnUi.pending = null;
      state.turnUi.popup = null;
      if (state.tutorial.active && state.tutorial.step === 6 && button.dataset.category === "attack") {
        setTutorialStep(7);
      }
      renderGame(snapshot);
      renderTutorialOverlay();
    });
  });
  el.playerForm.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.turnUi.popup) return;
      if (!tutorialAllows("move", button.dataset.move)) return;
      handleMoveSelection(snapshot, button.dataset.move);
    });
  });
  el.playerForm.querySelectorAll("[data-tower-seat]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.turnUi.popup) return;
      if (!tutorialAllows("tower", button.dataset.towerName)) return;
      handleTowerSelection(snapshot, Number(button.dataset.towerSeat), button.dataset.towerName);
    });
  });
  el.playerForm.querySelectorAll("[data-remove-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.turnUi.popup) return;
      removeDraftAction(Number(button.dataset.removeAction));
      renderGame(snapshot);
    });
  });
  el.playerForm.querySelectorAll("[data-clear-decision]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.turnUi.popup) return;
      clearDecisionDraft();
      renderGame(snapshot);
    });
  });
  el.playerForm.querySelectorAll("[data-popup-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.popupCancel === "distributedGuess" && state.turnUi.pending?.kind === "distributed") {
        state.turnUi.popup = null;
        renderGame(snapshot);
        return;
      }
      state.turnUi.pending = null;
      state.turnUi.popup = null;
      renderGame(snapshot);
    });
  });
  el.playerForm.querySelectorAll("[data-popup-submit]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!tutorialAllows("popup-submit", button.dataset.popupSubmit)) return;
      handlePopupSubmit(snapshot, button.dataset.popupSubmit);
    });
  });
  document.getElementById("arena-popup-guess")?.addEventListener("change", (event) => {
    if (state.turnUi.popup) {
      state.turnUi.popup.guess = event.target.value;
    }
  });
  document.getElementById("arena-popup-nation")?.addEventListener("change", (event) => {
    if (state.turnUi.popup) {
      state.turnUi.popup.nation = event.target.value;
    }
  });
  document.getElementById("arena-popup-tower")?.addEventListener("change", (event) => {
    if (state.turnUi.popup) {
      state.turnUi.popup.tower = event.target.value;
    }
  });
  document.getElementById("arena-popup-action")?.addEventListener("change", (event) => {
    if (state.turnUi.popup) {
      state.turnUi.popup.action = event.target.value;
    }
  });
  ["Parliament", "Base", "Office"].forEach((tower) => {
    document.getElementById(`arena-popup-${tower}`)?.addEventListener("change", (event) => {
      if (state.turnUi.popup) {
        state.turnUi.popup.guesses = {
          ...(state.turnUi.popup.guesses || {}),
          [tower]: event.target.value,
        };
      }
    });
  });
  el.playerForm.querySelectorAll("[data-submit-turn]").forEach((button) => {
    button.addEventListener("click", () => submitTurn().catch((error) => window.alert(error.message)));
  });
  el.playerForm.querySelectorAll("[data-leave-match]").forEach((button) => {
    button.addEventListener("click", clearSession);
  });
  el.playerForm.querySelectorAll("[data-cancel-selection]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.turnUi.popup) return;
      if (tutorialBlocksInteraction()) return;
      state.turnUi.pending = null;
      state.turnUi.popup = null;
      renderGame(snapshot);
    });
  });
  if (turnLocked) {
    return;
  }
}

function handleMoveSelection(snapshot, moveType) {
  if (state.turnDraft.day !== snapshot.game.displayDay) {
    state.turnDraft = createEmptyTurnDraft(snapshot);
  }
  const category = getMoveCategory(moveType);
  if (category !== "decision" && getRemainingActionCount(snapshot) <= 0) return;
  if (category !== "decision" && isMoveAlreadyUsed(snapshot, moveType)) return;
  if (category === "decision" && state.turnDraft.decision.type) return;

  state.turnUi.pending = null;
  state.turnUi.popup = null;

  if (category === "decision") {
    if (["War Mobilization", "Strategic Reserve", "Total Mobilization", "Expanded Command"].includes(moveType)) {
      state.turnDraft.decision = {
        type: moveType,
        targetSeat: "",
        payload: "",
        guesses: { Parliament: "", Base: "", Office: "" },
      };
      renderGame(snapshot);
      return;
    }
    if (moveType === "Priority Target") {
      state.turnUi.pending = { kind: "priorityDecision", moveType };
      renderGame(snapshot);
      return;
    }
    if (moveType === "Leader's Intervention") {
      state.turnUi.popup = { type: "intervention", moveType };
      renderGame(snapshot);
      return;
    }
    if (moveType === "Full Exposure") {
      state.turnUi.popup = { type: "fullExposure", moveType };
      renderGame(snapshot);
      return;
    }
    return;
  }

  if (["Signal Jam", "Counter"].includes(moveType)) {
    addDraftAction(snapshot, { type: moveType });
    renderGame(snapshot);
    return;
  }
  if (["Interception", "Move Check"].includes(moveType)) {
    state.turnUi.popup = { type: "nationOnlyAction", moveType };
    renderGame(snapshot);
    return;
  }
  if (moveType === "HP Check") {
    state.turnUi.popup = { type: "hpCheck", moveType };
    renderGame(snapshot);
    return;
  }
  if (moveType === "Distributed Assault") {
    state.turnUi.pending = { kind: "distributed", moveType, targets: [] };
    renderGame(snapshot);
    return;
  }
  if (["Fortify", "Repair", "Evacuation", "Sabotage"].includes(moveType)) {
    state.turnUi.pending = { kind: "towerAction", moveType, scope: "self" };
    renderGame(snapshot);
    return;
  }
  state.turnUi.pending = { kind: "towerAction", moveType, scope: "enemy" };
  if (state.tutorial.active && state.tutorial.step === 7 && moveType === "Target Strike") {
    setTutorialStep(8);
  }
  renderGame(snapshot);
}

function handleTowerSelection(snapshot, seat, towerName) {
  const pending = state.turnUi.pending;
  if (!pending) return;
  if (pending.kind === "priorityDecision") {
    state.turnDraft.decision = {
      type: "Priority Target",
      targetSeat: String(seat),
      payload: towerName,
      guesses: { Parliament: "", Base: "", Office: "" },
    };
    state.turnUi.pending = null;
    renderGame(snapshot);
    return;
  }
  if (pending.kind === "towerAction") {
    if (pending.scope === "self" && seat !== snapshot.game.playerSeat) return;
    if (pending.scope === "enemy" && seat === snapshot.game.playerSeat) return;
    if (["Target Strike", "Siege Operation"].includes(pending.moveType)) {
      state.turnUi.popup = {
        type: "guessAfterTowerAction",
        moveType: pending.moveType,
        targetSeat: seat,
        targetTower: towerName,
      };
      if (state.tutorial.active && state.tutorial.step === 8 && pending.moveType === "Target Strike" && towerName === "Base") {
        setTutorialStep(9);
      }
      renderGame(snapshot);
      return;
    }
    addDraftAction(snapshot, {
      type: pending.moveType,
      targetSeat: pending.scope === "enemy" ? String(seat) : "",
      targetTower: towerName,
      guess: "",
    });
    state.turnUi.pending = null;
    renderGame(snapshot);
    return;
  }
  if (pending.kind === "distributed") {
    if (seat === snapshot.game.playerSeat) return;
    if (pending.targets.some((target) => target.targetSeat === String(seat) && target.targetTower === towerName)) return;
    state.turnUi.popup = {
      type: "distributedGuess",
      moveType: pending.moveType,
      pendingTargetSeat: seat,
      pendingTargetTower: towerName,
      targets: pending.targets.slice(),
    };
    renderGame(snapshot);
  }
}

function handlePopupSubmit(snapshot, popupType) {
  if (popupType === "guessAfterTowerAction") {
    const guess = document.getElementById("arena-popup-guess")?.value || "";
    const popup = state.turnUi.popup;
    if (!guess || !popup) return;
    addDraftAction(snapshot, {
      type: popup.moveType,
      targetSeat: String(popup.targetSeat),
      targetTower: popup.targetTower,
      guess,
    });
    state.turnUi.pending = null;
    state.turnUi.popup = null;
    if (state.tutorial.active && state.tutorial.step === 9) {
      setTutorialStep(10);
    }
    renderGame(snapshot);
    return;
  }
  if (popupType === "nationOnlyAction") {
    const nation = document.getElementById("arena-popup-nation")?.value || "";
    const popup = state.turnUi.popup;
    if (!nation || !popup) return;
    addDraftAction(snapshot, {
      type: popup.moveType,
      targetSeat: nation,
    });
    state.turnUi.popup = null;
    renderGame(snapshot);
    return;
  }
  if (popupType === "hpCheck") {
    const nation = document.getElementById("arena-popup-nation")?.value || "";
    const tower = document.getElementById("arena-popup-tower")?.value || "";
    if (!nation || !tower) return;
    addDraftAction(snapshot, {
      type: "HP Check",
      targetSeat: nation,
      targetTower: tower,
    });
    state.turnUi.popup = null;
    renderGame(snapshot);
    return;
  }
  if (popupType === "distributedGuess") {
    const popup = state.turnUi.popup;
    if (!popup || state.turnUi.pending?.kind !== "distributed") return;
    const guess = document.getElementById("arena-popup-guess")?.value || "";
    state.turnUi.pending.targets.push({
      targetSeat: String(popup.pendingTargetSeat),
      targetTower: popup.pendingTargetTower,
      guess,
    });
    state.turnUi.popup = null;
    if (state.turnUi.pending.targets.length === 3) {
      addDraftAction(snapshot, {
        type: "Distributed Assault",
        targets: state.turnUi.pending.targets,
      });
      state.turnUi.pending = null;
    }
    renderGame(snapshot);
    return;
  }
  if (popupType === "intervention") {
    const nation = document.getElementById("arena-popup-nation")?.value || "";
    const action = document.getElementById("arena-popup-action")?.value || "";
    if (!nation || !action) return;
    state.turnDraft.decision = {
      type: "Leader's Intervention",
      targetSeat: nation,
      payload: action,
      guesses: { Parliament: "", Base: "", Office: "" },
    };
    state.turnUi.popup = null;
    renderGame(snapshot);
    return;
  }
  if (popupType === "fullExposure") {
    const nation = document.getElementById("arena-popup-nation")?.value || "";
    const guesses = {
      Parliament: document.getElementById("arena-popup-Parliament")?.value || "",
      Base: document.getElementById("arena-popup-Base")?.value || "",
      Office: document.getElementById("arena-popup-Office")?.value || "",
    };
    if (!nation || Object.values(guesses).some((value) => !value)) return;
    state.turnDraft.decision = {
      type: "Full Exposure",
      targetSeat: nation,
      payload: "",
      guesses,
    };
    state.turnUi.popup = null;
    renderGame(snapshot);
  }
}
/* legacy form renderer removed */
function renderGameLegacy(snapshot) {
  const you = snapshot.game.you;
  if (!state.turnDraft || state.turnDraft.day !== snapshot.game.displayDay) {
    state.turnDraft = createEmptyTurnDraft(snapshot);
  }
  const actionLimit = getAvailableActionLimit(snapshot);
  const turnLocked = you.lastSubmittedDay === snapshot.game.displayDay;
  el.turnHeading.textContent = `Day ${snapshot.game.displayDay} - ${you.nationName}`;
  el.statusBanner.innerHTML = `
    <strong>${you.nationName}</strong>
    <br>
    <span class="meta-text">Gold: ${you.gold} | Score: ${you.score} | Submitted today: ${you.lastSubmittedDay === snapshot.game.displayDay ? "Yes" : "No"}</span>
  `;

  el.scoreboard.innerHTML = snapshot.game.nations.map((nation) => `
    <div class="score-card">
      <h3>${nation.nationName}</h3>
      ${
        nation.seat === snapshot.game.playerSeat
          ? `
            <div class="tower-grid">
              ${Object.entries(nation.towers).map(([tower, data]) => `
                <div class="tower-box ${data.hp <= 0 ? "dead" : ""}">
                  <span class="compact-label">${tower}</span>
                  <strong>${data.hp} HP</strong>
                </div>
              `).join("")}
            </div>
          `
          : `
            <div class="tower-grid">
              ${Object.entries(nation.towers).map(([tower, data]) => `
                <div class="tower-box ${data.hp <= 0 ? "dead" : ""}">
                  <span class="compact-label">${tower}</span>
                  <strong>${data.hp > 0 ? "Alive" : "Destroyed"}</strong>
                </div>
              `).join("")}
            </div>
          `
      }
    </div>
  `).join("");

  const activeTreaties = you.activeTreaties.map((treaty) => `<div class="subtle-box">Active treaty with ${treaty.withNation}: ${treaty.remaining} day(s)</div>`).join("");
  const incomingOffers = you.incomingTreaties.map((offer) => `
    <div class="subtle-box">
      <p class="meta-text">${offer.fromNation} proposed a ${offer.duration}-day treaty.</p>
      <select data-offer-id="${offer.offerId}" class="treaty-response-select">
        <option value="">No response</option>
        <option value="accept">Accept</option>
        <option value="decline">Decline</option>
      </select>
    </div>
  `).join("");

  const decisionOptions = `<option value="">No decision</option>${snapshot.constants.nationalDecisions.map((decision) => `<option value="${decision}">${decision}</option>`).join("")}`;
  const actionOptions = `<option value="">No action</option>${[
    ...snapshot.constants.attackActions,
    ...snapshot.constants.defenseActions,
    ...snapshot.constants.intelActions,
  ].map((action) => `<option value="${action}">${action}</option>`).join("")}`;

  el.playerForm.innerHTML = `
    <section class="action-card">
      <h3>Your Turn</h3>
      <div class="subtle-box">
        <span class="compact-label">Treaties</span>
        ${activeTreaties || '<div class="meta-text">No active treaties.</div>'}
        ${incomingOffers}
        <div class="inline-grid">
          <div>
            <label class="compact-label" for="treaty-target">Propose Treaty To</label>
            <select id="treaty-target">${nationOptions(snapshot)}</select>
          </div>
          <div>
            <label class="compact-label" for="treaty-duration">Duration</label>
            <select id="treaty-duration">
              <option value="1">1 day</option>
              <option value="2" selected>2 days</option>
              <option value="3">3 days</option>
            </select>
          </div>
        </div>
      </div>

      <div class="subtle-box">
        <span class="compact-label">National Decision</span>
        <div class="action-row">
          <label class="compact-label" for="decision-type">Decision</label>
          <select id="decision-type">${decisionOptions}</select>
          <div id="decision-details" class="hidden">
            <div id="decision-priority-wrap" class="hidden">
              <label class="compact-label" for="decision-target">Target Nation</label>
              <select id="decision-target">${nationOptions(snapshot)}</select>
              <label class="compact-label" for="decision-payload">Target Tower</label>
              <select id="decision-payload">${towerOptions()}</select>
            </div>
            <div id="decision-intervention-wrap" class="hidden">
              <label class="compact-label" for="decision-target-intervention">Target Nation</label>
              <select id="decision-target-intervention">${nationOptions(snapshot)}</select>
              <label class="compact-label" for="decision-action">Blocked Action</label>
              <select id="decision-action">
                <option value="">Select action</option>
                ${[...snapshot.constants.attackActions, ...snapshot.constants.defenseActions, ...snapshot.constants.intelActions].map((action) => `<option value="${action}">${action}</option>`).join("")}
              </select>
            </div>
            <div id="decision-exposure-wrap" class="hidden">
              <label class="compact-label" for="decision-target-exposure">Target Nation</label>
              <select id="decision-target-exposure">${fullExposureNationOptions(snapshot)}</select>
              <div class="tower-grid">
                ${snapshot.constants.towers.map((tower) => `
                  <div>
                    <label class="compact-label" for="fe-${tower}">${tower} Guess</label>
                    <select id="fe-${tower}">${characterOptions("Select character")}</select>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="action-grid">
        ${Array.from({ length: actionLimit }, (_, index) => `
          <div class="action-row ${index >= actionLimit ? "hidden" : ""}" id="action-row-${index}">
            <h3>Action ${index + 1}</h3>
            <label class="compact-label" for="action-type-${index}">Move</label>
            <select id="action-type-${index}" ${index >= actionLimit ? "disabled" : ""}>${actionOptions}</select>
            <label class="compact-label hidden" id="action-target-label-${index}" for="action-target-${index}">Target Nation</label>
            <select id="action-target-${index}" class="hidden" ${index >= actionLimit ? "disabled" : ""}>${nationOptions(snapshot)}</select>
            <label class="compact-label hidden" id="action-tower-label-${index}" for="action-tower-${index}">Target Tower</label>
            <select id="action-tower-${index}" class="hidden" ${index >= actionLimit ? "disabled" : ""}>${towerOptions()}</select>
            <div id="action-guess-wrap-${index}" class="hidden">
              <label class="compact-label" for="action-guess-${index}">Character Guess</label>
              <select id="action-guess-${index}" ${index >= actionLimit ? "disabled" : ""}>${characterOptions("No guess")}</select>
            </div>
            <div id="distributed-wrap-${index}" class="distributed-grid hidden">
              ${Array.from({ length: 3 }, (_, dist) => `
                <div class="subtle-box distributed-row">
                  <span class="compact-label">Distributed ${dist + 1}</span>
                  <select id="dist-target-${index}-${dist}" ${index >= actionLimit ? "disabled" : ""}>${nationOptions(snapshot)}</select>
                  <select id="dist-tower-${index}-${dist}" ${index >= actionLimit ? "disabled" : ""}>${towerOptions()}</select>
                  <select id="dist-guess-${index}-${dist}" ${index >= actionLimit ? "disabled" : ""}>${characterOptions("No guess")}</select>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;

  hydrateTurnDraft(snapshot);
  bindTurnDraftEvents(snapshot);
  updateActionAvailability(snapshot);
  el.playerForm.querySelectorAll("select").forEach((select) => {
    select.disabled = turnLocked || select.disabled;
  });
  const card = el.playerForm.querySelector(".action-card");
  if (card) {
    card.classList.toggle("submitted-card", turnLocked);
  }
  el.submitTurnButton.disabled = turnLocked;
  el.submitTurnButton.textContent = turnLocked ? "Turn Submitted ✓" : "Submit Turn";
}

function renderLogs(snapshot) {
  const history = snapshot.game.you.resolutionHistory || {};
  const days = snapshot.game.you.logDays || [];
  if (days.length && !days.includes(state.selectedLogDay)) {
    state.selectedLogDay = days[days.length - 1];
  }
  el.logTabs.innerHTML = days.map((day) => `
    <button type="button" class="log-tab ${day === state.selectedLogDay ? "active" : ""}" data-log-day="${day}">Day ${day}</button>
  `).join("");
  el.logTabs.querySelectorAll("[data-log-day]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedLogDay = Number(button.dataset.logDay);
      renderLogs(snapshot);
    });
  });
  const entries = history[state.selectedLogDay] || [];
  el.globalLog.innerHTML = entries.length
    ? entries.map((entry) => `<div class="log-entry">${entry}</div>`).join("")
    : `<div class="log-entry">No private results yet.</div>`;
}

function renderChat(snapshot) {
  const chat = snapshot.chat || [];
  el.chatLog.innerHTML = chat.length
    ? chat.map((message) => `
      <div class="chat-message ${message.seat === snapshot.game.playerSeat ? "is-self" : ""}">
        <strong>${message.displayName}</strong>
        <span>${message.text}</span>
      </div>
    `).join("")
    : `<div class="log-entry">No messages yet.</div>`;
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

function render() {
  const snapshot = state.snapshot;
  el.heroStatus.textContent = snapshot ? (snapshot.game.finished ? "Match Complete" : snapshot.game.started ? "In Match" : "Lobby Open") : "Not Connected";
  el.heroLobby.textContent = state.lobbyId || "None";
  el.inviteLink.textContent = state.inviteLink || "";
  el.leaveLobbyButton.classList.toggle("hidden", !snapshot || snapshot.game.started);
  el.forfeitButton.classList.toggle("hidden", !snapshot || !snapshot.game.started || snapshot.game.finished);
  el.leaveMatchButton.classList.toggle("hidden", !snapshot || !snapshot.game.finished);

  const connected = Boolean(snapshot);
  const inGame = Boolean(snapshot?.game?.started);
  el.heroPanel.classList.toggle("hidden", inGame);
  el.landingPanel.classList.toggle("hidden", connected);
  el.lobbyPanel.classList.toggle("hidden", !connected || inGame);
  el.gamePanel.classList.toggle("hidden", !connected || !snapshot.game.started);
  el.logPanel.classList.toggle("hidden", !connected || !snapshot.game.started);
  el.rulesPanel.classList.toggle("hidden", inGame);

  if (!snapshot) {
    renderTutorialOverlay();
    return;
  }
  renderRoster(snapshot);
  renderSetup(snapshot);
  if (snapshot.game.started) {
    renderGame(snapshot);
    renderLogs(snapshot);
    renderChat(snapshot);
  }
  renderTutorialOverlay();
}

function collectCharacters() {
  return {
    Parliament: state.setupDraft.Parliament || document.getElementById("setup-Parliament").value,
    Base: state.setupDraft.Base || document.getElementById("setup-Base").value,
    Office: state.setupDraft.Office || document.getElementById("setup-Office").value,
  };
}

function collectSubmission() {
  const decision = state.turnDraft.decision.type
    ? {
        type: state.turnDraft.decision.type,
        targetSeat: optionalNumber(state.turnDraft.decision.targetSeat),
        payload: state.turnDraft.decision.payload || "",
        guess: ["Parliament", "Base", "Office"].map((tower) => state.turnDraft.decision.guesses[tower] || ""),
        guesses: { ...state.turnDraft.decision.guesses },
      }
    : null;

  const treaty = state.turnDraft.treaty.targetSeat
    ? {
        targetSeat: optionalNumber(state.turnDraft.treaty.targetSeat),
        duration: Number(state.turnDraft.treaty.duration || "2"),
      }
    : null;

  const treatyResponses = Object.entries(state.turnDraft.treatyResponses || {})
    .filter(([, response]) => response)
    .map(([offerId, response]) => ({
      offerId: Number(offerId),
      response,
    }));

  const actions = state.turnDraft.actions
    .filter((action) => action.type)
    .map((action) => action.type === "Distributed Assault"
      ? {
          type: action.type,
          targets: action.targets
            .filter((target) => target.targetSeat !== "" && target.targetTower)
            .map((target) => ({
              targetSeat: optionalNumber(target.targetSeat),
              targetTower: target.targetTower,
              guess: target.guess || "",
            })),
        }
      : {
          type: action.type,
          targetSeat: optionalNumber(action.targetSeat),
          targetTower: action.targetTower || "",
          guess: action.guess || "",
        });

  return { decision, treaty, treatyResponses, actions };
}

function getAvailableActionLimit(snapshot) {
  const you = snapshot.game.you;
  let count = you.towers.Base.hp > 0 ? 3 : 2;
  const decisionType = state.turnDraft?.decision?.type || "";
  if (decisionType === "War Mobilization") count += 1;
  if (decisionType === "Expanded Command") return 8;
  return count;
}

function optionalNumber(value) {
  return value === "" || value == null ? null : Number(value);
}

async function createLobby(playerCountOverride = null, defaultName = "") {
  const displayName = (el.createName.value || "").trim() || defaultName;
  const payload = await api("/api/lobbies", {
    method: "POST",
    body: {
      displayName,
      playerCount: Number(playerCountOverride || el.createSize.value),
    },
  });
  state.lobbyId = payload.lobbyId;
  state.token = payload.token;
  saveSession();
  history.replaceState({}, "", `/?lobby=${payload.lobbyId}`);
  beginPolling();
  await refreshState();
}

function openPracticeModal() {
  el.practiceModal.classList.remove("hidden");
}

function closePracticeModal() {
  el.practiceModal.classList.add("hidden");
}

async function startPractice(mode) {
  closePracticeModal();
  state.practiceMode = mode;
  if (mode === "tutorial") {
    setTutorialStep(1);
  } else {
    setTutorialStep(0);
  }
  await createLobby(1, "Player");
}

async function joinLobby() {
  const lobbyId = (el.joinCode.value || new URLSearchParams(window.location.search).get("lobby") || "").trim().toUpperCase();
  const payload = await api(`/api/lobbies/${encodeURIComponent(lobbyId)}/join`, {
    method: "POST",
    body: { displayName: el.joinName.value.trim() },
  });
  state.lobbyId = payload.lobbyId;
  state.token = payload.token;
  saveSession();
  history.replaceState({}, "", `/?lobby=${payload.lobbyId}`);
  beginPolling();
  await refreshState();
}

function clearSession() {
  state.lobbyId = "";
  state.token = "";
  state.inviteLink = "";
  state.snapshot = null;
  state.pendingSnapshot = null;
  state.selectedLogDay = null;
  state.turnDraft = null;
  state.practiceMode = "";
  setTutorialStep(0);
  resetTurnUi();
  if (state.pollHandle) {
    clearInterval(state.pollHandle);
    state.pollHandle = null;
  }
  localStorage.removeItem("art-of-war-session");
  history.replaceState({}, "", "/");
  closePracticeModal();
  closeMoveGuide();
  dismissWarPhasePopup();
  render();
}

async function readyUp() {
  if (!tutorialAllows("ready")) return;
  await api("/api/setup", {
    method: "POST",
    body: {
      lobbyId: state.lobbyId,
      token: state.token,
      characters: collectCharacters(),
    },
  });
  state.setupDraft = {
    Parliament: "",
    Base: "",
    Office: "",
  };
  await refreshState();
  if (state.tutorial.active && state.tutorial.step === 2 && state.snapshot?.game?.started) {
    setTutorialStep(3);
    render();
  }
}

async function submitTurn() {
  if (!tutorialAllows("submit-turn")) return;
  const confirmed = window.confirm("Submit this turn?");
  if (!confirmed) return;
  const snapshot = await api("/api/submit", {
    method: "POST",
    body: {
      lobbyId: state.lobbyId,
      token: state.token,
      submission: collectSubmission(),
    },
  });
  state.turnUi.pending = null;
  state.turnUi.popup = null;
  applySnapshot(snapshot);
  window.alert("Turn submitted successfully.");
  if (state.tutorial.active && state.tutorial.step === 10) {
    setTutorialStep(11);
    render();
  }
}

async function sendChat() {
  const text = (el.chatInput.value || "").trim();
  if (!text) return;
  const snapshot = await api("/api/chat", {
    method: "POST",
    body: {
      lobbyId: state.lobbyId,
      token: state.token,
      text,
    },
  });
  el.chatInput.value = "";
  applySnapshot(snapshot);
}

async function leaveLobby() {
  await api("/api/leave", {
    method: "POST",
    body: {
      lobbyId: state.lobbyId,
      token: state.token,
    },
  });
  clearSession();
}

async function forfeitMatch() {
  const snapshot = await api("/api/forfeit", {
    method: "POST",
    body: {
      lobbyId: state.lobbyId,
      token: state.token,
    },
  });
  applySnapshot(snapshot);
  window.alert("You forfeited the match.");
}

function createEmptyTurnDraft(snapshot) {
  return {
    day: snapshot.game.displayDay,
    treaty: { targetSeat: "", duration: "2" },
    treatyResponses: {},
    decision: {
      type: "",
      targetSeat: "",
      payload: "",
      guesses: { Parliament: "", Base: "", Office: "" },
    },
    actions: Array.from({ length: 8 }, () => ({
      type: "",
      targetSeat: "",
      targetTower: "",
      guess: "",
      targets: Array.from({ length: 3 }, () => ({
        targetSeat: "",
        targetTower: "",
        guess: "",
      })),
    })),
  };
}

function createEmptyActionDraft() {
  return {
    type: "",
    targetSeat: "",
    targetTower: "",
    guess: "",
    targets: Array.from({ length: 3 }, () => ({
      targetSeat: "",
      targetTower: "",
      guess: "",
    })),
  };
}

function resetActionDraft(index) {
  state.turnDraft.actions[index] = createEmptyActionDraft();
  const typeSelect = document.getElementById(`action-type-${index}`);
  if (!typeSelect) return;
  const targetSelect = document.getElementById(`action-target-${index}`);
  const towerSelect = document.getElementById(`action-tower-${index}`);
  const guessSelect = document.getElementById(`action-guess-${index}`);
  typeSelect.value = "";
  if (targetSelect) targetSelect.value = "";
  if (towerSelect) towerSelect.value = "";
  if (guessSelect) guessSelect.value = "";
  for (let dist = 0; dist < 3; dist += 1) {
    const distTarget = document.getElementById(`dist-target-${index}-${dist}`);
    const distTower = document.getElementById(`dist-tower-${index}-${dist}`);
    const distGuess = document.getElementById(`dist-guess-${index}-${dist}`);
    if (distTarget) distTarget.value = "";
    if (distTower) distTower.value = "";
    if (distGuess) distGuess.value = "";
  }
  updateActionVisibility(index);
}

function enforceUniqueActionSelections(snapshot) {
  if (snapshot.game.you.totalMobilization) return;
  const limit = getAvailableActionLimit(snapshot);
  const seen = new Set();
  for (let index = 0; index < limit; index += 1) {
    const action = state.turnDraft.actions[index];
    if (!action.type) continue;
    if (seen.has(action.type)) {
      resetActionDraft(index);
      continue;
    }
    seen.add(action.type);
  }
}

function enforceDistributedUniqueTargets() {
  for (let actionIndex = 0; actionIndex < 8; actionIndex += 1) {
    const action = state.turnDraft?.actions?.[actionIndex];
    if (!action || action.type !== "Distributed Assault") continue;
    const seen = new Set();
    for (let dist = 0; dist < 3; dist += 1) {
      const target = action.targets[dist];
      const key = `${target.targetSeat}:${target.targetTower}`;
      if (!target.targetSeat || !target.targetTower || !seen.has(key)) {
        if (target.targetSeat && target.targetTower) seen.add(key);
        continue;
      }
      action.targets[dist] = { targetSeat: "", targetTower: "", guess: "" };
      const distTarget = document.getElementById(`dist-target-${actionIndex}-${dist}`);
      const distTower = document.getElementById(`dist-tower-${actionIndex}-${dist}`);
      const distGuess = document.getElementById(`dist-guess-${actionIndex}-${dist}`);
      if (distTarget) distTarget.value = "";
      if (distTower) distTower.value = "";
      if (distGuess) distGuess.value = "";
    }
  }
}

function hydrateTurnDraft(snapshot) {
  const draft = state.turnDraft;
  document.getElementById("treaty-target").value = draft.treaty.targetSeat;
  document.getElementById("treaty-duration").value = draft.treaty.duration;
  document.getElementById("decision-type").value = draft.decision.type;
  if (document.getElementById("decision-target")) {
    document.getElementById("decision-target").value = draft.decision.targetSeat;
  }
  if (document.getElementById("decision-payload")) {
    document.getElementById("decision-payload").value = draft.decision.payload;
  }
  if (document.getElementById("decision-target-intervention")) {
    document.getElementById("decision-target-intervention").value = draft.decision.targetSeat;
  }
  if (document.getElementById("decision-action")) {
    document.getElementById("decision-action").value = draft.decision.payload;
  }
  if (document.getElementById("decision-target-exposure")) {
    document.getElementById("decision-target-exposure").value = draft.decision.targetSeat;
  }
  snapshot.constants.towers.forEach((tower) => {
    document.getElementById(`fe-${tower}`).value = draft.decision.guesses[tower];
  });
  document.querySelectorAll(".treaty-response-select").forEach((select) => {
    select.value = draft.treatyResponses[select.dataset.offerId] || "";
  });
  for (let index = 0; index < 8; index += 1) {
    const action = draft.actions[index];
    const typeInput = document.getElementById(`action-type-${index}`);
    const targetInput = document.getElementById(`action-target-${index}`);
    const towerInput = document.getElementById(`action-tower-${index}`);
    const guessInput = document.getElementById(`action-guess-${index}`);
    if (!typeInput || !targetInput || !towerInput || !guessInput) continue;
    typeInput.value = action.type;
    targetInput.value = action.targetSeat;
    towerInput.value = action.targetTower;
    guessInput.value = action.guess;
    for (let dist = 0; dist < 3; dist += 1) {
      const distTarget = document.getElementById(`dist-target-${index}-${dist}`);
      const distTower = document.getElementById(`dist-tower-${index}-${dist}`);
      const distGuess = document.getElementById(`dist-guess-${index}-${dist}`);
      if (!distTarget || !distTower || !distGuess) continue;
      distTarget.value = action.targets[dist].targetSeat;
      distTower.value = action.targets[dist].targetTower;
      distGuess.value = action.targets[dist].guess;
    }
    updateActionVisibility(index);
  }
  updateDecisionVisibility();
  updateActionAvailability(snapshot);
  enforceUniqueActionSelections(snapshot);
  updateRepeatedMoveOptions(snapshot);
  enforceDistributedUniqueTargets();
  updateDistributedDuplicateOptions();
}

function bindTurnDraftEvents(snapshot) {
  const draft = state.turnDraft;
  document.getElementById("treaty-target").addEventListener("change", (event) => {
    draft.treaty.targetSeat = event.target.value;
  });
  document.getElementById("treaty-duration").addEventListener("change", (event) => {
    draft.treaty.duration = event.target.value;
  });
  document.querySelectorAll(".treaty-response-select").forEach((select) => {
    select.addEventListener("change", (event) => {
      draft.treatyResponses[event.target.dataset.offerId] = event.target.value;
    });
  });
  document.getElementById("decision-type").addEventListener("change", (event) => {
    draft.decision.type = event.target.value;
    renderGame(snapshot);
  });
  const priorityTarget = document.getElementById("decision-target");
  const priorityPayload = document.getElementById("decision-payload");
  const interventionTarget = document.getElementById("decision-target-intervention");
  const interventionAction = document.getElementById("decision-action");
  const exposureTarget = document.getElementById("decision-target-exposure");
  if (priorityTarget) priorityTarget.addEventListener("change", (event) => { draft.decision.targetSeat = event.target.value; });
  if (priorityPayload) priorityPayload.addEventListener("change", (event) => { draft.decision.payload = event.target.value; });
  if (interventionTarget) interventionTarget.addEventListener("change", (event) => { draft.decision.targetSeat = event.target.value; });
  if (interventionAction) interventionAction.addEventListener("change", (event) => { draft.decision.payload = event.target.value; });
  if (exposureTarget) exposureTarget.addEventListener("change", (event) => { draft.decision.targetSeat = event.target.value; });
  snapshot.constants.towers.forEach((tower) => {
    document.getElementById(`fe-${tower}`).addEventListener("change", (event) => {
      draft.decision.guesses[tower] = event.target.value;
    });
  });
  for (let index = 0; index < 8; index += 1) {
    const typeInput = document.getElementById(`action-type-${index}`);
    const targetInput = document.getElementById(`action-target-${index}`);
    const towerInput = document.getElementById(`action-tower-${index}`);
    const guessInput = document.getElementById(`action-guess-${index}`);
    if (!typeInput || !targetInput || !towerInput || !guessInput) continue;
    typeInput.addEventListener("change", (event) => {
      draft.actions[index].type = event.target.value;
      updateActionVisibility(index);
      enforceUniqueActionSelections(snapshot);
      updateRepeatedMoveOptions(snapshot);
    });
    targetInput.addEventListener("change", (event) => {
      draft.actions[index].targetSeat = event.target.value;
    });
    towerInput.addEventListener("change", (event) => {
      draft.actions[index].targetTower = event.target.value;
    });
    guessInput.addEventListener("change", (event) => {
      draft.actions[index].guess = event.target.value;
    });
    for (let dist = 0; dist < 3; dist += 1) {
      const distTarget = document.getElementById(`dist-target-${index}-${dist}`);
      const distTower = document.getElementById(`dist-tower-${index}-${dist}`);
      const distGuess = document.getElementById(`dist-guess-${index}-${dist}`);
      if (!distTarget || !distTower || !distGuess) continue;
      distTarget.addEventListener("change", (event) => {
        draft.actions[index].targets[dist].targetSeat = event.target.value;
        enforceDistributedUniqueTargets();
        updateDistributedDuplicateOptions();
      });
      distTower.addEventListener("change", (event) => {
        draft.actions[index].targets[dist].targetTower = event.target.value;
        enforceDistributedUniqueTargets();
        updateDistributedDuplicateOptions();
      });
      distGuess.addEventListener("change", (event) => {
        draft.actions[index].targets[dist].guess = event.target.value;
      });
    }
  }
}

function updateDecisionVisibility() {
  const type = document.getElementById("decision-type")?.value || "";
  const details = document.getElementById("decision-details");
  const priority = document.getElementById("decision-priority-wrap");
  const intervention = document.getElementById("decision-intervention-wrap");
  const exposure = document.getElementById("decision-exposure-wrap");
  if (!details || !priority || !intervention || !exposure) return;
  details.classList.toggle("hidden", !["Priority Target", "Leader's Intervention", "Full Exposure"].includes(type));
  priority.classList.toggle("hidden", type !== "Priority Target");
  intervention.classList.toggle("hidden", type !== "Leader's Intervention");
  exposure.classList.toggle("hidden", type !== "Full Exposure");
}

function updateActionVisibility(index) {
  const type = document.getElementById(`action-type-${index}`)?.value || "";
  const targetLabel = document.getElementById(`action-target-label-${index}`);
  const targetSelect = document.getElementById(`action-target-${index}`);
  const towerLabel = document.getElementById(`action-tower-label-${index}`);
  const towerSelect = document.getElementById(`action-tower-${index}`);
  const guessWrap = document.getElementById(`action-guess-wrap-${index}`);
  const distributedWrap = document.getElementById(`distributed-wrap-${index}`);
  if (!targetLabel || !targetSelect || !towerLabel || !towerSelect || !guessWrap || !distributedWrap) return;

  const needsNation = ["Strike", "Target Strike", "Siege Operation", "Coordinated Assault", "Deep Surveillance", "HP Check", "Move Check", "Interception"].includes(type);
  const needsTower = ["Strike", "Target Strike", "Siege Operation", "Coordinated Assault", "Fortify", "Repair", "Evacuation", "Sabotage", "Deep Surveillance"].includes(type);
  const needsGuess = ["Target Strike", "Siege Operation"].includes(type);
  const isDistributed = type === "Distributed Assault";

  targetLabel.classList.toggle("hidden", !needsNation);
  targetSelect.classList.toggle("hidden", !needsNation);
  towerLabel.classList.toggle("hidden", !needsTower);
  towerSelect.classList.toggle("hidden", !needsTower);
  guessWrap.classList.toggle("hidden", !needsGuess);
  distributedWrap.classList.toggle("hidden", !isDistributed);
}

function updateActionAvailability(snapshot) {
  const limit = getAvailableActionLimit(snapshot);
  for (let index = 0; index < 8; index += 1) {
    const row = document.getElementById(`action-row-${index}`);
    if (!row) continue;
    const shouldShow = index < limit;
    row.classList.toggle("hidden", !shouldShow);
    row.hidden = !shouldShow;
    row.style.display = shouldShow ? "" : "none";
    row.querySelectorAll("select").forEach((select) => {
      select.disabled = !shouldShow;
    });
    if (!shouldShow && state.turnDraft?.actions?.[index]) {
      state.turnDraft.actions[index] = createEmptyActionDraft();
    }
  }
}

function updateRepeatedMoveOptions(snapshot) {
  const limit = getAvailableActionLimit(snapshot);
  const totalMobilization = snapshot.game.you.totalMobilization;
  const selectedTypes = state.turnDraft.actions.slice(0, limit).map((action) => action.type).filter(Boolean);

  for (let index = 0; index < 8; index += 1) {
    const select = document.getElementById(`action-type-${index}`);
    if (!select) continue;
    if (index >= limit) {
      Array.from(select.options).forEach((option) => {
        option.disabled = false;
      });
      continue;
    }
    const currentValue = state.turnDraft.actions[index].type;
    Array.from(select.options).forEach((option) => {
      if (!option.value) {
        option.disabled = false;
        return;
      }
      option.disabled = !totalMobilization && option.value !== currentValue && selectedTypes.includes(option.value);
    });
  }
}

function updateDistributedDuplicateOptions() {
  for (let actionIndex = 0; actionIndex < 8; actionIndex += 1) {
    const type = state.turnDraft?.actions?.[actionIndex]?.type || "";
    if (type !== "Distributed Assault") continue;
    const targets = state.turnDraft.actions[actionIndex].targets;
    for (let dist = 0; dist < 3; dist += 1) {
      const towerSelect = document.getElementById(`dist-tower-${actionIndex}-${dist}`);
      const nationValue = targets[dist].targetSeat;
      const currentTower = targets[dist].targetTower;
      if (!towerSelect) continue;
      Array.from(towerSelect.options).forEach((option) => {
        if (!option.value) {
          option.disabled = false;
          return;
        }
        const duplicate = targets.some((target, otherIndex) => otherIndex !== dist && target.targetSeat === nationValue && target.targetTower === option.value && nationValue !== "");
        option.disabled = duplicate && option.value !== currentTower;
      });
    }
  }
}

function interactionShouldPauseRendering(target) {
  return Boolean(target && target.closest && target.closest("#setup-grid, #player-form"));
}

document.addEventListener("focusin", (event) => {
  if (interactionShouldPauseRendering(event.target)) {
    state.suppressRenderWhileEditing = true;
  }
});

document.addEventListener("focusout", () => {
  window.setTimeout(() => {
    const active = document.activeElement;
    if (interactionShouldPauseRendering(active)) {
      return;
    }
    state.suppressRenderWhileEditing = false;
    if (state.pendingSnapshot) {
      applySnapshot(state.pendingSnapshot);
    }
  }, 0);
});

function renderMoveGuide() {
  el.moveGuideContent.innerHTML = Object.entries(moveDescriptions)
    .map(([move, description]) => `
      <div class="subtle-box">
        <strong>${move}</strong>
        <p class="meta-text">${description}</p>
      </div>
    `)
    .join("");
}

function openMoveGuide() {
  if (!tutorialAllows("move-guide")) return;
  el.moveGuideModal.classList.remove("hidden");
  if (state.tutorial.active && state.tutorial.step === 12) {
    setTutorialStep(13);
    renderTutorialOverlay();
  }
}

function closeMoveGuide() {
  el.moveGuideModal.classList.add("hidden");
}

el.createLobbyButton.addEventListener("click", () => createLobby().catch((error) => window.alert(error.message)));
el.practiceButton.addEventListener("click", openPracticeModal);
el.joinLobbyButton.addEventListener("click", () => joinLobby().catch((error) => window.alert(error.message)));
el.readyButton.addEventListener("click", () => readyUp().catch((error) => window.alert(error.message)));
el.submitTurnButton.addEventListener("click", () => submitTurn().catch((error) => window.alert(error.message)));
el.copyLinkButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(state.inviteLink);
});
el.leaveLobbyButton.addEventListener("click", () => leaveLobby().catch((error) => window.alert(error.message)));
el.forfeitButton.addEventListener("click", () => forfeitMatch().catch((error) => window.alert(error.message)));
el.leaveMatchButton.addEventListener("click", clearSession);
el.moveGuideButton.addEventListener("click", openMoveGuide);
el.moveGuideClose.addEventListener("click", closeMoveGuide);
el.moveGuideDismiss.addEventListener("click", closeMoveGuide);
el.practiceClose.addEventListener("click", closePracticeModal);
el.practiceTutorialButton.addEventListener("click", () => startPractice("tutorial").catch((error) => window.alert(error.message)));
el.practiceRegularButton.addEventListener("click", () => startPractice("regular").catch((error) => window.alert(error.message)));
el.tutorialNextButton.addEventListener("click", advanceTutorial);
el.warPhasePopupButton.addEventListener("click", dismissWarPhasePopup);
el.chatSendButton.addEventListener("click", () => sendChat().catch((error) => window.alert(error.message)));
el.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendChat().catch((error) => window.alert(error.message));
  }
});

renderMoveGuide();

let arenaResizeReflowTimer;
window.addEventListener("resize", () => {
  if (!state.snapshot?.game?.started) return;
  clearTimeout(arenaResizeReflowTimer);
  arenaResizeReflowTimer = window.setTimeout(() => {
    if (!state.suppressRenderWhileEditing) render();
  }, 120);
});

loadSession();
if (state.lobbyId && state.token) {
  beginPolling();
  refreshState();
} else if (new URLSearchParams(window.location.search).get("lobby")) {
  el.joinCode.value = new URLSearchParams(window.location.search).get("lobby");
}
