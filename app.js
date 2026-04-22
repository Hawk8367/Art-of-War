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
  "Identity Check": 40,
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
  "Identity Check": "40 gold. Check if a nation uses a character.",
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
  heroStatus: document.getElementById("hero-status"),
  heroLobby: document.getElementById("hero-lobby"),
  landingPanel: document.getElementById("landing-panel"),
  lobbyPanel: document.getElementById("lobby-panel"),
  gamePanel: document.getElementById("game-panel"),
  logPanel: document.getElementById("log-panel"),
  createName: document.getElementById("create-name"),
  createSize: document.getElementById("create-size"),
  joinName: document.getElementById("join-name"),
  joinCode: document.getElementById("join-code"),
  createLobbyButton: document.getElementById("create-lobby-button"),
  joinLobbyButton: document.getElementById("join-lobby-button"),
  inviteLink: document.getElementById("invite-link"),
  copyLinkButton: document.getElementById("copy-link-button"),
  lobbyRoster: document.getElementById("lobby-roster"),
  setupPanel: document.getElementById("setup-panel"),
  setupGrid: document.getElementById("setup-grid"),
  readyButton: document.getElementById("ready-button"),
  turnHeading: document.getElementById("turn-heading"),
  statusBanner: document.getElementById("status-banner"),
  scoreboard: document.getElementById("scoreboard"),
  playerForm: document.getElementById("player-form"),
  submitTurnButton: document.getElementById("submit-turn-button"),
  logTabs: document.getElementById("log-tabs"),
  globalLog: document.getElementById("global-log"),
  moveGuideButton: document.getElementById("move-guide-button"),
  moveGuideModal: document.getElementById("move-guide-modal"),
  moveGuideClose: document.getElementById("move-guide-close"),
  moveGuideDismiss: document.getElementById("move-guide-dismiss"),
  moveGuideContent: document.getElementById("move-guide-content"),
};

function saveSession() {
  localStorage.setItem("art-of-war-session", JSON.stringify({ lobbyId: state.lobbyId, token: state.token }));
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
    window.alert(`All players submitted. Day ${snapshot.game.displayDay} has begun.`);
  }
  state.lastSeenDisplayDay = snapshot.game.displayDay;
  render();
}

function renderRoster(snapshot) {
  el.lobbyRoster.innerHTML = snapshot.roster
    .map((player) => `
      <div class="score-card">
        <h3>${player.displayName}</h3>
        <p class="meta-text">${player.nationName}</p>
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
    select.disabled = you.ready;
    select.addEventListener("change", () => {
      state.setupDraft[tower] = select.value;
    });
  });
}

function nationOptions(snapshot, includeEmpty = true) {
  const currentSeat = snapshot.game.playerSeat;
  const options = snapshot.game.nations
    .filter((nation) => nation.seat !== currentSeat)
    .map((nation) => `<option value="${nation.seat}">${nation.nationName}</option>`);
  return `${includeEmpty ? '<option value="">None</option>' : ""}${options.join("")}`;
}

function fullExposureNationOptions(snapshot) {
  const currentSeat = snapshot.game.playerSeat;
  const used = snapshot.game.you.fullExposureUsed || {};
  const options = snapshot.game.nations
    .filter((nation) => nation.seat !== currentSeat)
    .map((nation) => `<option value="${nation.seat}" ${used[nation.seat] ? "disabled" : ""}>${nation.nationName}${used[nation.seat] ? " (Used)" : ""}</option>`);
  return `<option value="">None</option>${options.join("")}`;
}

function towerOptions() {
  return `<option value="">None</option><option value="Parliament">Parliament</option><option value="Base">Base</option><option value="Office">Office</option>`;
}

function characterOptions(optionalLabel = "None") {
  return `<option value="">${optionalLabel}</option>${state.snapshot.constants.characters.map((character) => `<option value="${character}">${character}</option>`).join("")}`;
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
  if (type === "decision") return "decision";
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
  if (category === "jamming") return JAMMING_ACTIONS;
  if (category === "defense") return CORE_DEFENSE_ACTIONS;
  return [];
}

function getArenaSeatLayout(playerCount) {
  const layouts = {
    2: [
      { x: 50, y: 16 },
      { x: 50, y: 70 },
    ],
    3: [
      { x: 50, y: 14 },
      { x: 23, y: 58 },
      { x: 77, y: 58 },
    ],
    4: [
      { x: 50, y: 12 },
      { x: 80, y: 42 },
      { x: 50, y: 72 },
      { x: 20, y: 42 },
    ],
  };
  return layouts[playerCount] || layouts[4];
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

function getPendingInstruction(snapshot) {
  const pending = state.turnUi.pending;
  if (!pending) return `Choose a category below. ${getRemainingActionCount(snapshot)} action(s) remaining.`;
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
  if (snapshot.game.you.totalMobilization) return false;
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
    return !pending.targets.some((target) => target.targetSeat === nation.seat && target.targetTower === towerName);
  }
  return false;
}

function renderOrdersQueue(snapshot, turnLocked) {
  const actionEntries = state.turnDraft.actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => action.type);
  const decision = state.turnDraft.decision.type
    ? `<div class="order-pill order-pill-decision">
        <div>
          <strong>National Decision</strong>
          <span>${state.turnDraft.decision.type}</span>
        </div>
        ${turnLocked ? "" : '<button type="button" class="order-remove" data-clear-decision="1">Clear</button>'}
      </div>`
    : "";
  const actions = actionEntries.map(({ action, index }) => `
    <div class="order-pill">
      <div>
        <strong>${action.type}</strong>
        <span>${describeQueuedAction(snapshot, action)}</span>
      </div>
      ${turnLocked ? "" : `<button type="button" class="order-remove" data-remove-action="${index}">Clear</button>`}
    </div>
  `).join("");
  return decision || actions
    ? `<div class="orders-queue">${decision}${actions}</div>`
    : `<div class="meta-text">No orders queued yet.</div>`;
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

function renderArena(snapshot) {
  const layout = getArenaSeatLayout(snapshot.game.playerCount);
  return snapshot.game.nations.map((nation, index) => {
    const position = layout[index] || layout[layout.length - 1];
    const colorClass = `nation-${NATION_COLORS[index % NATION_COLORS.length]}`;
    return `
      <div class="arena-nation ${nation.seat === snapshot.game.playerSeat ? "is-self" : ""}" style="left:${position.x}%;top:${position.y}%;">
        <div class="arena-nation-name">${nation.nationName}</div>
        <div class="arena-cluster ${colorClass}">
          ${["Parliament", "Base", "Office"].map((towerName) => {
            const tower = nation.towers[towerName];
            const selectable = isTowerSelectable(snapshot, nation, towerName, tower);
            return `
              <button
                type="button"
                class="arena-tower ${tower.hp <= 0 ? "is-destroyed" : ""} ${selectable ? "is-selectable" : ""}"
                data-tower-seat="${nation.seat}"
                data-tower-name="${towerName}"
                ${selectable ? "" : "disabled"}
              >
                <span class="arena-tower-name">${towerName}</span>
                <span class="arena-tower-meta">${getTowerBadgeText(snapshot, nation, towerName, tower)}</span>
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
  if (!moves.length) return "";
  return `
    <div class="move-tray">
      ${moves.map((move) => {
        const disabled = turnLocked
          || (category !== "decision" && getRemainingActionCount(snapshot) === 0)
          || (category === "decision" && Boolean(state.turnDraft.decision.type))
          || (category !== "decision" && isMoveAlreadyUsed(snapshot, move));
        return `
          <button type="button" class="move-chip" data-move="${move}" ${disabled ? "disabled" : ""}>
            <span>${move}</span>
            <strong>${MOVE_COSTS[move] === 0 ? "Free" : `${MOVE_COSTS[move]}g`}</strong>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderDiplomacyPanel(snapshot, turnLocked) {
  const you = snapshot.game.you;
  return `
    <div class="arena-sidecard">
      <div class="sidecard-header">
        <h3>Diplomacy</h3>
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
        <select id="arena-popup-guess">${characterOptions("Select character")}</select>
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
        <select id="arena-popup-nation">${nationOptions(snapshot)}</select>
        <div class="popup-actions">
          <button type="button" class="secondary-button" data-popup-cancel="1">Cancel</button>
          <button type="button" class="primary-button" data-popup-submit="nationOnlyAction">Confirm</button>
        </div>
      </div>
    `;
  }
  if (popup.type === "identityCheck") {
    return `
      <div class="arena-popup-backdrop"></div>
      <div class="arena-popup">
        <h3>Identity Check</h3>
        <p class="meta-text">Choose a nation and character.</p>
        <select id="arena-popup-nation">${nationOptions(snapshot)}</select>
        <select id="arena-popup-guess">${characterOptions("Select character")}</select>
        <div class="popup-actions">
          <button type="button" class="secondary-button" data-popup-cancel="1">Cancel</button>
          <button type="button" class="primary-button" data-popup-submit="identityCheck">Confirm</button>
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
        <select id="arena-popup-guess">${characterOptions("No guess")}</select>
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
        <select id="arena-popup-nation">${nationOptions(snapshot)}</select>
        <select id="arena-popup-action">
          <option value="">Select action</option>
          ${[...snapshot.constants.attackActions, ...CORE_DEFENSE_ACTIONS, ...JAMMING_ACTIONS, ...snapshot.constants.intelActions].map((action) => `<option value="${action}">${action}</option>`).join("")}
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
        <select id="arena-popup-nation">${fullExposureNationOptions(snapshot)}</select>
        ${snapshot.constants.towers.map((tower) => `
          <label class="compact-label" for="arena-popup-${tower}">${tower}</label>
          <select id="arena-popup-${tower}">${characterOptions("Select character")}</select>
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
  el.statusBanner.innerHTML = `<span class="meta-text">${getPendingInstruction(snapshot)}</span>`;
  el.scoreboard.innerHTML = "";
  el.scoreboard.classList.add("hidden");
  el.submitTurnButton.classList.add("hidden");

  el.playerForm.className = "arena-shell";
  el.playerForm.innerHTML = `
    <section class="arena-board ${turnLocked ? "submitted-card" : ""}">
      <div class="arena-hud">
        <div class="arena-stat left">
          <span>Points</span>
          <strong>${you.score}</strong>
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

      <div class="arena-field">
        ${renderArena(snapshot)}
      </div>

      <div class="arena-lower">
        <div class="arena-side">
          ${renderDiplomacyPanel(snapshot, turnLocked)}
          <div class="arena-sidecard">
            <div class="sidecard-header">
              <h3>Queued Orders</h3>
              <span class="meta-text">${getRemainingActionCount(snapshot)} action(s) left</span>
            </div>
            ${renderOrdersQueue(snapshot, turnLocked)}
          </div>
        </div>

        <div class="arena-command">
          ${renderCategoryDock(snapshot, turnLocked)}
          ${renderMoveTray(snapshot, turnLocked)}
          <div class="command-actions">
            <button type="button" class="secondary-button" data-cancel-selection="1" ${state.turnUi.pending || state.turnUi.popup ? "" : "disabled"}>Cancel Selection</button>
            <button type="button" class="primary-button" data-submit-turn="1" ${turnLocked ? "disabled" : ""}>${turnLocked ? "Turn Submitted" : "Submit Turn"}</button>
          </div>
        </div>
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
      state.turnUi.selectedCategory = button.dataset.category;
      state.turnUi.pending = null;
      state.turnUi.popup = null;
      renderGame(snapshot);
    });
  });
  el.playerForm.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      handleMoveSelection(snapshot, button.dataset.move);
    });
  });
  el.playerForm.querySelectorAll("[data-tower-seat]").forEach((button) => {
    button.addEventListener("click", () => {
      handleTowerSelection(snapshot, Number(button.dataset.towerSeat), button.dataset.towerName);
    });
  });
  el.playerForm.querySelectorAll("[data-remove-action]").forEach((button) => {
    button.addEventListener("click", () => {
      removeDraftAction(Number(button.dataset.removeAction));
      renderGame(snapshot);
    });
  });
  el.playerForm.querySelectorAll("[data-clear-decision]").forEach((button) => {
    button.addEventListener("click", () => {
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
      handlePopupSubmit(snapshot, button.dataset.popupSubmit);
    });
  });
  el.playerForm.querySelectorAll("[data-submit-turn]").forEach((button) => {
    button.addEventListener("click", () => submitTurn().catch((error) => window.alert(error.message)));
  });
  el.playerForm.querySelectorAll("[data-cancel-selection]").forEach((button) => {
    button.addEventListener("click", () => {
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
  if (moveType === "Identity Check") {
    state.turnUi.popup = { type: "identityCheck", moveType };
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
  if (popupType === "identityCheck") {
    const nation = document.getElementById("arena-popup-nation")?.value || "";
    const guess = document.getElementById("arena-popup-guess")?.value || "";
    if (!nation || !guess) return;
    addDraftAction(snapshot, {
      type: "Identity Check",
      targetSeat: nation,
      guess,
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

function render() {
  const snapshot = state.snapshot;
  el.heroStatus.textContent = snapshot ? (snapshot.game.finished ? "Match Complete" : snapshot.game.started ? "In Match" : "Lobby Open") : "Not Connected";
  el.heroLobby.textContent = state.lobbyId || "None";
  el.inviteLink.textContent = state.inviteLink || "";

  const connected = Boolean(snapshot);
  el.landingPanel.classList.toggle("hidden", connected);
  el.lobbyPanel.classList.toggle("hidden", !connected);
  el.gamePanel.classList.toggle("hidden", !connected || !snapshot.game.started);
  el.logPanel.classList.toggle("hidden", !connected || !snapshot.game.started);

  if (!snapshot) return;
  renderRoster(snapshot);
  renderSetup(snapshot);
  if (snapshot.game.started) {
    renderGame(snapshot);
    renderLogs(snapshot);
  }
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

async function createLobby() {
  const payload = await api("/api/lobbies", {
    method: "POST",
    body: {
      displayName: el.createName.value.trim(),
      playerCount: Number(el.createSize.value),
    },
  });
  state.lobbyId = payload.lobbyId;
  state.token = payload.token;
  saveSession();
  history.replaceState({}, "", `/?lobby=${payload.lobbyId}`);
  beginPolling();
  await refreshState();
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

async function readyUp() {
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
}

async function submitTurn() {
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

  const needsNation = ["Strike", "Target Strike", "Siege Operation", "Coordinated Assault", "Deep Surveillance", "Identity Check", "Move Check", "Interception"].includes(type);
  const needsTower = ["Strike", "Target Strike", "Siege Operation", "Coordinated Assault", "Fortify", "Repair", "Evacuation", "Sabotage", "Deep Surveillance"].includes(type);
  const needsGuess = ["Target Strike", "Siege Operation", "Identity Check"].includes(type);
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
  el.moveGuideModal.classList.remove("hidden");
}

function closeMoveGuide() {
  el.moveGuideModal.classList.add("hidden");
}

el.createLobbyButton.addEventListener("click", () => createLobby().catch((error) => window.alert(error.message)));
el.joinLobbyButton.addEventListener("click", () => joinLobby().catch((error) => window.alert(error.message)));
el.readyButton.addEventListener("click", () => readyUp().catch((error) => window.alert(error.message)));
el.submitTurnButton.addEventListener("click", () => submitTurn().catch((error) => window.alert(error.message)));
el.copyLinkButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(state.inviteLink);
});
el.moveGuideButton.addEventListener("click", openMoveGuide);
el.moveGuideClose.addEventListener("click", closeMoveGuide);
el.moveGuideDismiss.addEventListener("click", closeMoveGuide);

renderMoveGuide();
loadSession();
if (state.lobbyId && state.token) {
  beginPolling();
  refreshState();
} else if (new URLSearchParams(window.location.search).get("lobby")) {
  el.joinCode.value = new URLSearchParams(window.location.search).get("lobby");
}
